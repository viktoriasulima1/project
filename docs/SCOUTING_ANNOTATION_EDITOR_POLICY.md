# Scouting annotation editor policy

The editor uses Pointer Events with `touch-action:none` over an image-fit surface. Point, rectangle and text annotations store normalized 0–1 coordinates, so portrait/landscape and display resizing do not alter evidence. Rectangles have a 4% minimum size and remain inside the image; controls have mobile-size targets. Move, resize, label edit, delete, undo, cancel and save never modify original pixels. The textual list is the accessible equivalent of the visual overlay. Labels are plain bounded text, never HTML.

Before finalization, a draft may be edited normally. Finalized evidence uses `PhotoAnnotationVersion`: a new version, correction reason, actor and timestamp replace the effective view without overwriting history. The current UI foundation is pointer-capable; physical touch accuracy remains an iPhone/Android gate.
# Persistence integration

The real private photo detail uses the touch editor. Saves go through a farm-scoped API and create an auditable effective annotation version. Finalized photos require a correction reason; stale base versions return conflict and never overwrite server evidence. The original image is immutable. Offline draft annotations remain bound to the user/farm IndexedDB graph, but complete offline photo-detail correction and conflict UI still requires browser proof.
