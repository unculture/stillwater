# Stillwater

Stillwater is a browser toy with flowing rings, mouse and touch interaction, and gentle ambient music.

Play [Stillwater online](https://unculture.github.io/stillwater/).

From this directory, start the local server with Node.js:

```sh
npm run dev
```

Open http://localhost:5173 in your browser. You can also open `index.html` directly. The app needs no installed packages or external services.

Move your pointer to bend the threads. Click to create a ripple. Hold and drag to pull the current. Select Sound off to start the music.

The shape picker opens a gallery of 56 scenes from 54 Book of Shapes artworks. The original Tide, Bloom, and Orbit variations remain available.

Let it wander changes shapes automatically every 20, 45, or 90 seconds. A shuffled sequence visits every shape before it repeats. Pausing motion also pauses this sequence. An open dialog or a held pointer delays the next change.

The controls change the color palette and pace. The breathing guide follows a cycle of four seconds in, two seconds at rest, and six seconds out.

Keyboard controls are M for sound, Space for motion, B for breathing, H for controls, F for full screen, and R for a random shape. W toggles automatic wandering. Keys 1, 2, and 3 select the original shapes. The question mark opens the instructions and volume control.

The arrow beside Sound opens five soundscapes: Stillwater, Woodland stream, Rainforest, Quiet library, and Desert wind. Each setting has a different musical arrangement. Separate controls adjust music, surroundings, and overall volume. Set Music to zero to hear only the surroundings.

The app starts silently. It stores your shape, palette, pace, soundscape, mix, volume, and wandering interval in your browser. It pauses animation and fades audio when the tab is hidden. If your system requests reduced motion, the app starts with motion paused. Automatic wandering starts only when you select it.

The artwork comes from [Book of Shapes](https://bookofshapes.com) by Nikolaj Sokolowski. See [ARTWORK.md](ARTWORK.md) for source details and license terms.

The browser synthesizes all music through Web Audio. The app contains no recordings, tracking, remote fonts, or runtime downloads.

Run `npm run check` to inspect JavaScript syntax. Run `npm test` to test the shuffled sequence and smooth pointer response.

GitHub Pages publishes this repository from the root directory of the `main` branch. The `.nojekyll` file tells GitHub to serve the files directly. The site needs no build step.

Before you publish changes, run `npm run check` from this directory. Run `npm test`. Commit your changes. Run `git push origin main`. GitHub Pages updates the live site automatically.
