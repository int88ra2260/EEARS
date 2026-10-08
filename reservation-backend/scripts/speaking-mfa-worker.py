# Resident Montreal Forced Aligner for one read-aloud clip at a time.
# The acoustic model and lexicon stay in memory; each job only aligns a wav.

from __future__ import annotations

import json
import os
import socket
import sys
import traceback
from pathlib import Path


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


class ResidentAligner:
    def __init__(self, dictionary_name: str, acoustic_name: str):
        from montreal_forced_aligner import config
        from montreal_forced_aligner.command_line.utils import validate_model_arg
        from montreal_forced_aligner.data import (
            BRACKETED_WORD,
            CUTOFF_WORD,
            LAUGHTER_WORD,
            OOV_WORD,
        )
        from montreal_forced_aligner.dictionary.mixins import (
            DEFAULT_BRACKETS,
            DEFAULT_CLITIC_MARKERS,
            DEFAULT_COMPOUND_MARKERS,
            DEFAULT_PUNCTUATION,
            DEFAULT_WORD_BREAK_MARKERS,
        )
        from montreal_forced_aligner.online.alignment import tokenize_utterance_text
        from montreal_forced_aligner.tokenization.simple import SimpleTokenizer
        from kalpy.aligner import KalpyAligner
        from kalpy.feat.cmvn import CmvnComputer
        from kalpy.fstext.lexicon import HierarchicalCtm, LexiconCompiler
        from kalpy.utterance import Segment
        from kalpy.utterance import Utterance as KalpyUtterance
        from montreal_forced_aligner.corpus.classes import FileData

        config.load_configuration()
        config.CLEAN = False
        config.USE_POSTGRES = False

        self._tokenize_utterance_text = tokenize_utterance_text
        self._FileData = FileData
        self._Segment = Segment
        self._KalpyUtterance = KalpyUtterance
        self._HierarchicalCtm = HierarchicalCtm
        self._cmvn = CmvnComputer()

        acoustic_model = validate_model_arg(acoustic_name, "acoustic")
        dictionary = validate_model_arg(dictionary_name, "dictionary")
        self.acoustic_model = acoustic_model

        extracted_models_dir = config.TEMPORARY_DIRECTORY.joinpath("extracted_models", "dictionary")
        dictionary_directory = extracted_models_dir.joinpath(dictionary.path.stem)
        dictionary_directory.mkdir(parents=True, exist_ok=True)
        lexicon_compiler = LexiconCompiler(
            disambiguation=False,
            silence_probability=acoustic_model.parameters["silence_probability"],
            initial_silence_probability=acoustic_model.parameters["initial_silence_probability"],
            final_silence_correction=acoustic_model.parameters["final_silence_correction"],
            final_non_silence_correction=acoustic_model.parameters["final_non_silence_correction"],
            silence_phone=acoustic_model.parameters["optional_silence_phone"],
            oov_phone=acoustic_model.parameters["oov_phone"],
            position_dependent_phones=acoustic_model.parameters["position_dependent_phones"],
            phones=acoustic_model.parameters["non_silence_phones"],
            ignore_case=True,
        )
        l_fst_path = dictionary_directory.joinpath("L.fst")
        l_align_fst_path = dictionary_directory.joinpath("L_align.fst")
        words_path = dictionary_directory.joinpath("words.txt")
        phones_path = dictionary_directory.joinpath("phones.txt")
        if l_fst_path.exists():
            import pywrapfst

            lexicon_compiler.load_l_from_file(l_fst_path)
            lexicon_compiler.load_l_align_from_file(l_align_fst_path)
            lexicon_compiler.word_table = pywrapfst.SymbolTable.read_text(words_path)
            lexicon_compiler.phone_table = pywrapfst.SymbolTable.read_text(phones_path)
        else:
            lexicon_compiler.load_pronunciations(dictionary.path)
            lexicon_compiler.create_fsts()
            lexicon_compiler.clear()
            lexicon_compiler.fst.write(str(l_fst_path))
            lexicon_compiler.align_fst.write(str(l_align_fst_path))
            lexicon_compiler.word_table.write_text(words_path)
            lexicon_compiler.phone_table.write_text(phones_path)

        self.tokenizer = SimpleTokenizer(
            word_table=lexicon_compiler.word_table,
            word_break_markers=DEFAULT_WORD_BREAK_MARKERS,
            punctuation=DEFAULT_PUNCTUATION,
            clitic_markers=DEFAULT_CLITIC_MARKERS,
            compound_markers=DEFAULT_COMPOUND_MARKERS,
            brackets=DEFAULT_BRACKETS,
            laughter_word=LAUGHTER_WORD,
            oov_word=OOV_WORD,
            bracketed_word=BRACKETED_WORD,
            cutoff_word=CUTOFF_WORD,
            ignore_case=True,
        )
        self.aligner = KalpyAligner(acoustic_model, lexicon_compiler)
        self.lexicon_compiler = lexicon_compiler

    def align(self, wav_path: str, text_path: str, output_path: str) -> None:
        sound_file_path = Path(wav_path)
        text_file_path = Path(text_path)
        output = Path(output_path)
        file = self._FileData.parse_file(sound_file_path.stem, sound_file_path, text_file_path, "", 0)
        file_ctm = self._HierarchicalCtm([])
        utterances = []
        for utterance in file.utterances:
            segment = self._Segment(sound_file_path, utterance.begin, utterance.end, utterance.channel)
            normalized_text = self._tokenize_utterance_text(
                utterance.text,
                self.lexicon_compiler,
                self.tokenizer,
                None,
            )
            utt = self._KalpyUtterance(segment, normalized_text)
            utt.generate_mfccs(self.acoustic_model.mfcc_computer)
            utterances.append(utt)
        if not utterances:
            raise RuntimeError("No utterances to align.")
        cmvn = self._cmvn.compute_cmvn_from_features([utt.mfccs for utt in utterances])
        for utt in utterances:
            utt.apply_cmvn(cmvn)
            ctm = self.aligner.align_utterance(utt)
            file_ctm.word_intervals.extend(ctm.word_intervals)
        output.parent.mkdir(parents=True, exist_ok=True)
        file_ctm.export_textgrid(
            output,
            file_duration=file.wav_info.duration,
            output_format="long_textgrid",
        )


def serve(aligner: ResidentAligner, port: int) -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", port))
    server.listen(8)
    log(f"ready {port}")
    while True:
        conn, _addr = server.accept()
        try:
            raw = b""
            while b"\n" not in raw:
                chunk = conn.recv(65536)
                if not chunk:
                    break
                raw += chunk
                if len(raw) > 1_000_000:
                    break
            line = raw.decode("utf-8", errors="replace").split("\n", 1)[0].strip()
            job = json.loads(line) if line else {}
            if not job.get("wavPath"):
                payload = {"ok": True, "ready": True}
            else:
                aligner.align(job["wavPath"], job["textPath"], job["outputPath"])
                payload = {"ok": True}
            conn.sendall((json.dumps(payload) + "\n").encode("utf-8"))
        except Exception as error:
            message = "".join(traceback.format_exception_only(type(error), error)).strip()
            log(traceback.format_exc())
            try:
                conn.sendall((json.dumps({"ok": False, "error": message[:2000]}) + "\n").encode("utf-8"))
            except Exception:
                pass
        finally:
            try:
                conn.close()
            except Exception:
                pass


def main() -> None:
    dictionary_name = os.environ.get("SPEAKING_MFA_DICTIONARY") or os.environ.get("MFA_DICTIONARY")
    acoustic_name = os.environ.get("SPEAKING_MFA_ACOUSTIC_MODEL") or os.environ.get("MFA_ACOUSTIC_MODEL")
    if not dictionary_name or not acoustic_name:
        log("SPEAKING_MFA_DICTIONARY and SPEAKING_MFA_ACOUSTIC_MODEL are required")
        sys.exit(1)
    port = int(os.environ.get("SPEAKING_MFA_WORKER_PORT", "18765"))
    log(f"loading {acoustic_name} / {dictionary_name}")
    aligner = ResidentAligner(dictionary_name, acoustic_name)
    log("models loaded")
    serve(aligner, port)


if __name__ == "__main__":
    main()
