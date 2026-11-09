"""Hukamnama service: locates the daily Hukamnama from Sri Harmandir Sahib (published by SGPC)
inside the pinned Sri Guru Granth Sahib Ji corpus, and serves it by line-id range.

Prime directive: SGPC's text is used only to *locate* the shabad. Every Gurmukhi character this
service returns is copied from the corpus (``lines.gurmukhi``), never from a source page.
Runtime is Python-stdlib only, like ``webapp/serve.py``.
"""

__version__ = "0.1.0"
USER_AGENT = f"GurbaniSoul-Hukamnama/{__version__} (+https://gurbanisoul.com/support)"
