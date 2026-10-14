# App-icon geometry (vendored)

`mark.svg` and `pothi.svg` are the outlines of the Gurbani Soul app icon v2 ("Pothi & Naad"),
copied byte-for-byte from `Algorythmos-AI/gurbani-soul-ios` at
`ios/App/Resources/AppIcon.icon/Assets/` (commit `5592039`). They are generated there by
`make app-icon` (`ios/tools/make_app_icon.swift`) from Sant Lipi — **never edit them by hand**:
`mark.svg` is ੴ exactly as the font draws it.

`frontend/scripts/gen-icons.mjs` reads them to build the web, PWA and wiki icons, so the app and
the sites show one mark. When the app icon changes, copy the two files again and run
`node scripts/gen-icons.mjs` from `frontend/`.
