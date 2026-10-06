# Speaking Diagnostic Forced Alignment Runbook

This feature stores forced-alignment evidence inside `speaking_attempts.features.alignment`.

## Current pipeline

When a read-aloud attempt is submitted:

1. The browser uploads the recording and transcript.
2. The backend calls `alignSpeakingAttempt()`.
3. If `SPEAKING_ALIGNMENT_COMMAND` is configured, the backend sends a JSON payload to that command through stdin and reads JSON from stdout.
4. If no external command is configured, the backend creates a baseline timing alignment from target text and recording duration.
5. The response includes `alignment`, `features.alignment`, and alignment-derived metrics.

The baseline alignment is not a pronunciation model. It is a development fallback so the UI and data shape can be tested before MFA or another real aligner is installed. Baseline alignment should not produce `wordAcousticEvidence`, `phonemeEvidence`, `pronunciationPercent`, `Word acoustic`, `Phones`, or `Phone confidence`; those fields require a real external aligner.

## External aligner contract

Environment variables:

```env
SPEAKING_ALIGNMENT_COMMAND=node scripts/run-mfa-alignment.js
SPEAKING_ALIGNMENT_TIMEOUT_MS=120000
SPEAKING_FFMPEG_COMMAND=ffmpeg
SPEAKING_MFA_COMMAND=mfa
SPEAKING_MFA_DICTIONARY=english_us_arpa
SPEAKING_MFA_ACOUSTIC_MODEL=english_us_arpa
```

The command receives this JSON on stdin:

```json
{
  "attemptUid": "uuid",
  "audioPath": "D:/EEARS/reservation-backend/uploads/speaking-diagnostic/example.webm",
  "targetText": "Trying to get her to one place...",
  "transcript": "trying to get her to one place",
  "durationMs": 12000
}
```

It should emit JSON on stdout:

```json
{
  "status": "aligned",
  "engine": "mfa_english_us_arpa_v1",
  "words": [
    { "index": 0, "word": "trying", "startMs": 320, "endMs": 780, "confidence": 0.82 },
    { "index": 1, "word": "to", "startMs": 810, "endMs": 930, "confidence": 0.76 }
  ],
  "phones": [
    { "wordIndex": 0, "phone": "T", "startMs": 320, "endMs": 370 }
  ],
  "warnings": []
}
```

## Re-running alignment

After installing or changing the external aligner, existing attempts can be reprocessed:

```http
POST /api/admin/speaking-diagnostic/attempts/:attemptUid/alignment/recompute
```

The endpoint requires `can_view_learning_analytics`.

## Recommended next step

Use Montreal Forced Aligner as the first real backend aligner:

1. Convert uploaded WebM to WAV.
2. Create a temporary MFA corpus folder containing the WAV and a `.lab` file with the target text.
3. Run `mfa align <corpus> <dictionary> <acoustic_model> <output>`.
4. Parse MFA TextGrid output into the JSON contract above.
5. Return the JSON to EEARS stdout.

The project includes a runner for this flow:

```powershell
cd D:\EEARS\reservation-backend
npm run speaking:align:mfa:self-test
```

Self-test only checks the TextGrid parser. It does not require MFA.

To enable real MFA alignment in backend runtime, set:

```env
SPEAKING_ALIGNMENT_COMMAND=node scripts/run-mfa-alignment.js
SPEAKING_ALIGNMENT_TIMEOUT_MS=120000
SPEAKING_FFMPEG_COMMAND=ffmpeg
SPEAKING_MFA_COMMAND=mfa
SPEAKING_MFA_DICTIONARY=english_us_arpa
SPEAKING_MFA_ACOUSTIC_MODEL=english_us_arpa
```

If the MFA dictionary/acoustic model names differ on the server, use the installed names or absolute paths. If the machine uses Conda and `mfa` is only available inside an environment, point `SPEAKING_ALIGNMENT_COMMAND` to a small wrapper script that activates the environment and runs `node scripts/run-mfa-alignment.js`.
