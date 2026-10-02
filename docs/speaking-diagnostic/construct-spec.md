# EEARS Speaking Diagnostic Construct Spec

Status: v0 MVP for diagnostic and formative practice. This is not a certified CEFR proficiency test.

## Purpose

The EEARS Speaking Diagnostic collects observable speaking evidence from controlled and semi-controlled tasks, supports teacher calibration, and feeds Learning Journey / activity recommendation workflows.

The first usable tool focuses on controlled read-aloud tasks because the system knows the target text. This makes fluency, completion, and early pronunciation evidence more stable than open-ended proficiency scoring.

## Construct Dimensions

### Fluency

Evidence of continuous speech production without excessive breakdown.

Observable evidence:
- Speech rate in words per minute.
- Articulation rate excluding detected silent pauses.
- Pause frequency per minute.
- Average pause duration.
- Long-pause count.
- Filled pauses when transcript evidence is available.

Interpretation caution: Fast speech alone is not high fluency. Very fast, unclear, or incomplete speech should not be rewarded.

### Pronunciation / Intelligibility

Evidence that speech is understandable to listeners.

Observable evidence in v0:
- Teacher rating of intelligibility.
- Audio review.
- Placeholder fields for future phoneme accuracy, stress, rhythm, and pitch/prosody.

Future evidence:
- Forced alignment confidence.
- Phoneme-level likelihood or error flags.
- Word-level alignment.
- Prosodic contour and stress/rhythm features.

Interpretation caution: Accent is not the target. The construct is intelligibility and communicative clarity, not native-like pronunciation.

### Grammar

Evidence of grammatical control appropriate to the task.

Observable evidence in v0:
- Teacher analytical rating.
- Optional transcript-based markers when a transcript is available.

Future evidence:
- Error density.
- Clause complexity.
- Tense/aspect control.
- Subordination and coordination.

### Vocabulary

Evidence of lexical range and precision appropriate to the task.

Observable evidence in v0:
- Teacher analytical rating.
- Optional transcript length, unique word ratio, repeated words, and topic word coverage.

Future evidence:
- Lexical sophistication.
- CEFR lexical profile.
- Academic / campus-domain vocabulary use.

### Task Achievement

Evidence that the speaker completes the communicative demand of the task.

For read-aloud tasks this is mainly completion and intelligible delivery of the target text.

For semi-controlled and spontaneous tasks this expands to:
- Relevance to prompt.
- Idea development.
- Support with reasons or examples.
- Coherence and organization.

## MVP Evidence Levels

### Level 1 - Controlled Speech

Task type: read aloud.

Used for:
- Word completion.
- Fluency profile.
- First pronunciation/intelligibility review.
- Audio corpus collection.

### Level 2 - Semi-Controlled Speech

Task type: short answer, picture description, role-play response.

Used for:
- ASR transcript analysis.
- Grammar and vocabulary evidence.
- Discourse organization.

### Level 3 - Spontaneous Speaking

Task type: opinion response with preparation time.

Used for:
- Idea development.
- Coherence.
- Task achievement.
- Multidimensional ability estimation.

## Initial CEFR Scope

The first research and product scope is A2-B2. C1-C2 distinctions require stronger validation, larger calibration samples, and higher rater agreement.

## Scoring Principle

The system should not output "GPT says B1" as a score. It should store observable evidence, teacher ratings, and versioned scoring rules. Automated scoring is treated as evidence-assisted diagnostic feedback until calibrated against human ratings.

