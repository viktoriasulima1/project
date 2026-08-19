# AI voice data lifecycle

Text entry is always available. Browser speech recognition currently provides
the progressive UI path. The provider-neutral server contract accepts only
audio/webm, mp4, mpeg, wav or ogg, at most 8 MiB and 60 seconds, with a 12-second
timeout and per-user daily limit.

For a server transcription request, bytes exist only as request-local memory.
They are not written to PostgreSQL, IndexedDB, recovery JSON or logs. Only the
editable transcript may enter the existing namespaced text-draft policy. Cancel
and delete clear the transcript/recognizer reference. CI uses deterministic
transcription; physical microphone permission and OS/browser memory behavior
remain device-validation items.
