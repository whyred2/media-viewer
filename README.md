# LocalGallery

Browse a folder of photos and videos on your computer through a local web interface. Files stay on the machine running the app; there is no upload step, database, or account to create.

A personal project in active development. Feedback and small, focused contributions are welcome.

## Features

- Browse folders or view all media from the selected folder and its subfolders.
- Search filenames and filter by image format.
- Filter images and videos separately, or browse them together in the same sorted collection.
- Sort by name, file type, size, or modification date in ascending or descending order. Folders stay first; sorting is preserved in the URL and breadcrumb links.
- Responsive gallery with virtual scrolling: only visible rows and a small buffer are rendered.
- Fullscreen image viewer with zoom, pan, rotation, and download.
- Custom video player adapted from the portfolio, with translucent controls, wide rectangular seek/volume sliders, and sliding settings panels. Video posters are generated locally and cached.
- Playback speed, volume, and mute preferences persist locally. Settings stay inside the player in fullscreen and use a single panel on narrow screens.
- Clickable breadcrumbs for jumping to any parent folder.
- File information panel with size, dimensions, format, relative location, and modification date.
- Video information includes duration, codec, and frame rate.
- Light, dark, and system themes.
- WebP thumbnails generated locally with Sharp.
- Persistent thumbnail cache, versioned browser caching, and background loading of neighboring photos.

The gallery recognizes JPEG, PNG, GIF, WebP, BMP, TIFF, and AVIF files. Thumbnail decoding depends on Sharp, and original-image display depends on your browser; BMP thumbnails and TIFF originals may not display.

Recognized video containers are **MP4, M4V, WebM, MOV, MKV, AVI, and OGV**. Playback uses the original file and your browser's native decoder, with HTTP byte-range requests for seeking. Codec support varies by browser and operating system; MP4 with H.264/AAC and WebM are practical starting points. Unsupported files show a download option instead of forcing conversion. See the [MDN media format guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers).

[FFmpeg](https://github.com/eugeneware/ffmpeg-static) and [FFprobe](https://github.com/SavageCore/node-ffprobe-installer) binaries are installed as dependencies on supported platforms for video posters and metadata. Full videos are not transcoded or loaded into server memory.

## Run locally

Use Node.js **22.18 or newer** and Corepack. The project pins its pnpm version in `package.json`.

```sh
git clone https://github.com/whyred2/media-viewer.git
cd media-viewer
corepack pnpm install
corepack pnpm dev
```

Open **http://127.0.0.1:3000**. On first launch, enter the absolute path to your media folder, such as `D:\Photos` on Windows or `/home/you/Pictures` on Linux. You can change it later from **Settings → Change media folder**.

The path belongs to the machine running the server. The app needs read access to the photos and write access to its configuration file.

For a production build:

```sh
corepack pnpm build
corepack pnpm start
```

The build downloads the Geist fonts. Once dependencies and fonts have been built, viewing local photos does not require an internet connection.

Both start commands listen on **127.0.0.1** by default. LocalGallery is intended for use on a trusted personal computer and does not include authentication. Keep it local; do not expose it through a public server or tunnel.

## Configuration

The setup page creates `config.json`, which is excluded from Git. `config.example.json` documents its format; copying it is optional.

```json
{
  "rootDirectory": null
}
```

An unset root opens the setup page. Photos are read in place, and viewing or rotating an image does not modify the original file.

For a separate configuration profile, set `LOCAL_GALLERY_CONFIG` to the path of another JSON file before starting the app. Integration tests use this to avoid changing your own gallery settings.

Thumbnails are cached in `.cache/local-gallery` (excluded from Git), with a 256 MB disk budget and a 32 MB memory budget. Old entries are evicted automatically; deleting the cache only makes thumbnails regenerate. Set `LOCAL_GALLERY_CACHE` to store it elsewhere. Cache versions include the source location and modification information, so refreshing the gallery picks up changed photos and folder settings.

Originals stream directly from disk. After the current photo loads, the viewer can preload its neighboring photos at low priority, up to 24 MB combined; videos, files larger than 16 MB, and browsers using data-saving mode are skipped.

Directory listings contain relative paths. Both API endpoints enforce the configured root, including real filesystem paths. Symbolic links and directory junctions are omitted from listings and recursive scans.

## Viewer controls

| Control | Action |
| --- | --- |
| Left / Right arrow, A / D | Previous / next file when video controls are not focused |
| + / − | Zoom an image in / out |
| R | Rotate an image by 90° |
| I | Toggle file information |
| 0 | Reset the view |
| Escape | Close file information, then the viewer |
| Mouse wheel over image | Zoom |
| Mouse wheel over background | Previous / next image |
| Drag a zoomed image | Pan |
| Space / K in the video player | Play / pause |
| Left / Right arrow, J / L in the video player | Seek backward / forward 5 seconds |
| Up / Down arrow in the video player | Adjust volume |
| M / F in the video player | Toggle mute / fullscreen |
| Home / End in the video player | Seek to the start / end |
| Escape in video settings | Back from speeds, then close settings |

Video shortcuts apply while the player is focused; buttons and sliders retain their own keyboard controls. A / D still navigate between files outside settings and fullscreen. Dragging the timeline previews the time and seeks once on release. Image zoom, rotation, and mouse-wheel navigation are disabled while viewing a video. Moving to another file or closing the viewer stops playback.

## Development and checks

```sh
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm test:integration
```

Unit tests cover filesystem boundaries, path separators, media filters, HTTP ranges, caches, symlink/junction escapes, and player state. DOM tests use mocked media APIs to check playback failures, seeking, saved preferences, sliding settings, keyboard focus, and fullscreen behavior. Integration tests start isolated production servers and check mixed directory listings, image responses, MP4/WebM streaming and seeking, generated video posters, file information, breadcrumb links, and rejected requests. Video fixtures are generated locally with FFmpeg. Run the build before integration tests. DOM tests do not replace visual checks and playback testing in a real browser.

Built with Next.js, React, TypeScript, Tailwind CSS, Radix UI, TanStack Virtual, and Sharp.

Virtual scrolling limits rendered elements, but the initial scan still reads the requested folder tree and keeps its file list in memory. There is no persistent file index. The first request for an uncached thumbnail still needs image processing; repeated views use the cache. Very large collections and unsupported or corrupt images remain areas for improvement.

## License

[MIT](LICENSE) © Dmytro Yuzik.
