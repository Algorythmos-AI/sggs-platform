"""Hukamnama service: locates the daily Hukamnama from Sri Harmandir Sahib (published by SGPC)
inside the pinned Sri Guru Granth Sahib Ji corpus, and serves it by line-id range.

Prime directive: SGPC's text is used only to *locate* the shabad. Every Gurmukhi character this
service returns is copied from the corpus (``lines.gurmukhi``), never from a source page.
Runtime is Python stdlib, except the push sender (``push.py``), which needs the hash-locked
``requirements.txt`` (HTTP/2 + ES256 for APNs) and imports it only when sending is on.
"""

__version__ = "0.1.0"
USER_AGENT = f"GurbaniSoul-Hukamnama/{__version__} (+https://gurbanisoul.com/support)"
