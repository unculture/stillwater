# Artwork

Stillwater uses 54 SVG artworks from [Book of Shapes](https://bookofshapes.com), created by Nikolaj Sokolowski.

The app presents 56 scenes. Tide, Bloom, and Orbit use Concentric Noise Rings. The other 53 scenes use distinct artworks.

The [Book of Shapes license](https://bookofshapes.com/license) permits artwork use and modification within an experience. It prohibits redistribution as a pattern pack, clipart set, template library, or pattern generator.

Joy Division, Joy Division Mesh, and Brockmann Beethoven Arcs are excluded from this app. The site excludes those three works from its reuse license.

The source manifest is `assets/sources.json`. Each entry records the title, source page, and original SVG address. Original artwork files retain their geometry in `assets/shapes`.

The files with the `-art.svg` suffix adapt the colors for the Stillwater renderer. Run `python3 scripts/prepare-shapes.py` from this directory to rebuild those files and the scene catalog.

The renderer animates the artwork within the app. It provides no pattern export or generator. The app links to the source page for the active artwork.

The audio engine synthesizes all music and environmental sounds locally. It uses no third-party recordings.
