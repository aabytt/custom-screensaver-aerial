<div align="center">

<img src="assets/icon130.png" alt="Aerial webOS logo" width="96">

<h1>Aerial webOS Screensaver</h1>

<b>Aerial-style video screensaver for LG webOS TVs</b><br>
<sub>A fork of <a href="https://github.com/webosbrew/custom-screensaver">webosbrew/custom-screensaver</a></sub>

[![Latest release][badge-release]][releases-latest]
[![Downloads][badge-downloads]][releases]
[![Homebrew Channel][badge-homebrew]][homebrew]
[![Ask DeepWiki][badge-deepwiki]][deepwiki]

[Screenshots](#screenshots) ·
[Features](#features) ·
[Requirements](#requirements) ·
[Installation](#installation) ·
[Compatibility](#compatibility) ·
[Donate](#donate)

</div>

## Screenshots

<table>
  <tr>
    <td><a href="https://aabytt.github.io/aerial-preview/screenshots/001.webp"><img src="docs/screenshots/001.webp" width="100%"/></a></td>
    <td><a href="https://aabytt.github.io/aerial-preview/screenshots/002.webp"><img src="docs/screenshots/002.webp" width="100%"/></a></td>
    <td><a href="https://aabytt.github.io/aerial-preview/screenshots/003.webp"><img src="docs/screenshots/003.webp" width="100%"/></a></td>
  </tr>
  <tr>
    <td><a href="https://aabytt.github.io/aerial-preview/screenshots/004.webp"><img src="docs/screenshots/004.webp" width="100%"/></a></td>
    <td><a href="https://aabytt.github.io/aerial-preview/screenshots/005.webp"><img src="docs/screenshots/005.webp" width="100%"/></a></td>
    <td><a href="https://aabytt.github.io/aerial-preview/screenshots/006.webp"><img src="docs/screenshots/006.webp" width="100%"/></a></td>
  </tr>
</table>

## Features

* [330+ videos](https://aabytt.github.io/aerial-preview/) from different sources (Apple Aerials, Amazon FireOS, Jetson Creative, Robin Fourcade)
* 40+ locales for the OSD
* Source type selection (FullHD/4K SDR or Dolby Vision)
* Playlist editor
* Night mode: a separate playlist for the night hours
* Solar mode: playback follows the time of day (sunrise, day, sunset, night) based on the actual local time at your selected location
* On-screen display settings: font (including bold and custom fonts), size, position, 12/24 h clock
* Panel protection: custom brightness, gradual dimming, automatic panel off and standby, moving, drifting or fading text
* Clock-only mode when another app (e.g. a paused Jellyfin or Netflix session) holds the video decoder
* Autostart registration
* Launch the screensaver immediately for testing

> **Note:** Some features are model-dependent and may not be available on every TV.

## Requirements

* A rooted LG TV with the [Homebrew Channel](https://www.webosbrew.org/) installed
* webOS 3 (2016), webOS 3.5 (2017), webos 4 (2018), webOS 4.5 (2019) webOS 5 (2020), webOS 6 (2021), webOS 22 (7.x), webOS 23 (8.x), webOS 25 (10.x), webOS 26 (11.x)

> [!WARNING]
> The app replaces the original webOS screensaver. Use at your own risk.

## Installation

The app should be available in the Homebrew Channel. Otherwise, download the `.ipk` from
[Releases](https://github.com/aabytt/custom-screensaver-aerial/releases/latest) and install it on your TV
with your preferred tool (e.g. webOS Dev Manager or `ares-install`).

## Compatibility

See the [compatibility table](COMPATIBILITY.md) for tested TVs, or
[submit your own report](https://github.com/aabytt/custom-screensaver-aerial/issues/new?template=compatibility.yml).
Tap the `Version` field in the app to read your TV details.

webOS versions use a different implementation of the screensaver. See
[webOS screensaver notes](docs/webos-25-26.md) for how it works and for upgrade instructions.

## Donate

Looking for more sources or cool new features? Your support would mean the world!
Donations are entirely optional and don't affect support or access to any features.

**USDT (Tether), network: TRC-20 (Tron)**

`THKrpAfuQ8rbrjjMuvuLii7dcbUD6dVW93`

<details>
<summary>Show QR code</summary>

<img src="https://github.com/user-attachments/assets/0117dfbf-ada3-4eb0-9315-ff43fede1357" alt="USDT TRC-20 QR code" width="160">

</details>

> ⚠️ Send USDT on the **TRC-20** network only. Transfers on other networks (ERC-20, BEP-20, etc.) will be lost.

Other options:
* [YooMoney](https://yoomoney.ru/to/4100115685800097)

<!-- Badge and link definitions: keep these at the bottom of the file -->
[releases-latest]: https://github.com/aabytt/custom-screensaver-aerial/releases/latest
[releases]: https://github.com/aabytt/custom-screensaver-aerial/releases
[homebrew]: https://repo.webosbrew.org/apps/org.aabytt.webos.custom-screensaver-aerial/
[deepwiki]: https://deepwiki.com/aabytt/custom-screensaver-aerial
[badge-release]: https://img.shields.io/github/v/release/aabytt/custom-screensaver-aerial?style=plastic&logo=github
[badge-downloads]: https://img.shields.io/github/downloads/aabytt/custom-screensaver-aerial/total?logo=github&style=plastic
[badge-homebrew]: https://img.shields.io/badge/Homebrew_Channel-cf0652?style=plastic&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iMTYwIiB2aWV3Qm94PSIwIDAgNDIuMzMzIDQyLjMzMyI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNC4wOSAxLjAwNylzY2FsZSguOTAyMDEpIj48cGF0aCBkPSJNMzEuMTExIDEzLjg0MnM1LjQ2MS0xLjY0MSA1LjUwNCAzLjk0M2MuMDQzIDUuNTg1LTIuNzI3IDMuNzE3LTUuODc3IDQuMTY4IiBzdHlsZT0iZmlsbDpub25lO2ZpbGwtcnVsZTpldmVub2RkO3N0cm9rZTojZmZmO3N0cm9rZS13aWR0aDoyLjQ7c3Ryb2tlLWxpbmVjYXA6YnV0dDtzdHJva2UtbGluZWpvaW46bWl0ZXI7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIvPjxwYXRoIGQ9Im02Ljg0IDEzLjI3OCA3LjA4My0zLjI5NyA0LjgyNi41NyA1LjA0NyAyLjA1OSA1Ljk1OS0uMTIuOTgzIDkuNDYzLS40MDEgMTAuOTU1LTIuMjg1IDMuMzQ4LTUuOTQxLjU3Mi0xMC45NjYuMDk3LTMuNDY4LTEuODktLjg0My01LjA0OHoiIHN0eWxlPSJmaWxsOiNmZmY7ZmlsbC1vcGFjaXR5Oi4xNDI0Nzg7ZmlsbC1ydWxlOmV2ZW5vZGQ7c3Ryb2tlOm5vbmU7c3Ryb2tlLXdpZHRoOi4yNjQ1ODNweDtzdHJva2UtbGluZWNhcDpidXR0O3N0cm9rZS1saW5lam9pbjptaXRlcjtzdHJva2Utb3BhY2l0eToxIi8+PHBhdGggZD0iTTI5Ljc1NSAxMS45NmMtOC4wOTYgMS44MjItMTAuMjIyLTMuMzczLTE2LjQyLTIuMDQ1cy03LjMyIDEuMzItNy4zMiAxLjMyIiBzdHlsZT0iZmlsbDpub25lO2ZpbGwtb3BhY2l0eTouMTQyNDc4O2ZpbGwtcnVsZTpldmVub2RkO3N0cm9rZTojZmZmO3N0cm9rZS13aWR0aDo0Ljk2NTtzdHJva2UtbGluZWNhcDpidXR0O3N0cm9rZS1saW5lam9pbjptaXRlcjtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIi8+PHBhdGggZD0iTTMwLjMwMiA2LjkyN2MuMjc4IDguNDguODI0IDE3LjIyMyAwIDI0LjYzNS0uMzM1IDMuMDE1LTIuNTE0IDQuODE3LTUuNDc0IDUuNDc1LTQuMjYyLjk0Ny04LjUzOSAxLjAxNC0xMi44MzQgMC0yLjk1MS0uNjk3LTUuMTA2LTIuNDY0LTUuNDc0LTUuNDc1LTEuMDAyLTguMTktLjUtMTYuNDEyIDAtMjQuNjM1IiBzdHlsZT0iZmlsbDpub25lO2ZpbGwtb3BhY2l0eTouNTQwMzM3O3N0cm9rZTojZmZmO3N0cm9rZS13aWR0aDoyLjQ7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOm1pdGVyO3N0cm9rZS1taXRlcmxpbWl0OjQ7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1vcGFjaXR5OjEiLz48Y2lyY2xlIGN4PSIxMi44NDkiIGN5PSIxOC4yNDkiIHI9IjIuMDM1IiBzdHlsZT0ib3BhY2l0eTouNDIzMDE7ZmlsbDojZmZmO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDoxLjY5NTk5O3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjptaXRlcjtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIi8+PGNpcmNsZSBjeD0iMTguOTI0IiBjeT0iMTYuOTU3IiByPSIxLjQyMyIgc3R5bGU9ImZpbGw6I2ZmZjtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6LjcxNTkzNztzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46bWl0ZXI7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIvPjxjaXJjbGUgY3g9IjE4LjEyNCIgY3k9IjI5Ljg5NiIgcj0iMi41NjEiIHN0eWxlPSJvcGFjaXR5Oi42MDQwNjk7ZmlsbDojZmZmO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDoxLjU3NjY2O3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjptaXRlcjtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIi8+PGNpcmNsZSBjeD0iMjQuOTAzIiBjeT0iMjkuMzA1IiByPSIxLjA1MSIgc3R5bGU9Im9wYWNpdHk6LjYwNDA2OTtmaWxsOiNmZmY7ZmlsbC1vcGFjaXR5OjE7c3Ryb2tlOm5vbmU7c3Ryb2tlLXdpZHRoOjEuMDY1O3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjptaXRlcjtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIi8+PGNpcmNsZSBjeD0iMjQuMTEzIiBjeT0iMjIuMDg4IiByPSIzLjQyMSIgc3R5bGU9ImZpbGw6I2ZmZjtmaWxsLW9wYWNpdHk6MTtzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6Mi45Mzk1NDtzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46bWl0ZXI7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIvPjxjaXJjbGUgY3g9IjEyLjMyNyIgY3k9IjI2LjExMSIgcj0iMS40NzkiIHN0eWxlPSJvcGFjaXR5Oi45MDMwNTg7ZmlsbDojZmZmO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDoxLjA2NTtzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46bWl0ZXI7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIvPjxjaXJjbGUgY3g9IjE3LjQ5NSIgY3k9IjIzLjg3NCIgcj0iMS43ODkiIHN0eWxlPSJvcGFjaXR5Oi42MDQwNjk7ZmlsbDojZmZmO2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDoxLjgxMzE2O3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjptaXRlcjtzdHJva2UtbWl0ZXJsaW1pdDo0O3N0cm9rZS1kYXNoYXJyYXk6bm9uZTtzdHJva2Utb3BhY2l0eToxIi8+PC9nPjwvc3ZnPg==
[badge-deepwiki]: https://img.shields.io/badge/Ask_DeepWiki-007ec6?style=plastic&labelColor=black&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAACIUlEQVRYw%2B2XP2gUQRTGv7d3JhYWQawkIBaCVWzETos0gmAnVoKNTSoLK0E7EQQrC20sBVFBtLPQRgTBtBaKjYgIQUSxiJq7fT%2BLvCGPJZdNLt4dQj5Y3u7sznzfzLw%2Fs9IO%2FicANiniCujEfWdsQgBLxAbsbraPZcmBfcAt4DNwKQsZNfEUsAB8YRV12LfA6ZHuedg7AO7ed%2Fc%2BUBcbQhbiu%2B6wXIM6EnZWkszMJe2Ke0n6I2la0v51hFeSMLN6OwIK6jJwEBdUYb2MAxRSz6sY4geiahFgLe1Hwq6YWe3us8AN4FQQU4QM64SPY69Xyr43fADgNjAPXHb3peSsD4FDQ0VLEjAHvIhBPS6AHvA1bBO9JPAXcHFbIRtJ5yzwIQZ9CZwAusDJENIkLqsG8DpNyIZJwSUk9wLHgakcesC1JCCjiHm1kYDNOEjptCxpSVK/8f73OFLxPLAYM3oCzEX7MXf/lJbc/8kWpA4HgQdpYI9IWAbeh83whi84cHXL%2B58EPBoQhnmm94EzwE3gZ2p/Dhzdbhg%2BTaRr01x7ftb4/jBwFzjXrCvDpmLW9crVLNeR9CaapoGemb2TdCERW1tNaBNQ8jktwmozqwtpqRNtdWAjARYk39IS12ZWRX7vmJmA71nQZgi36gN7gCvAj5xc3P0jcH7kx7Ik5IC73wsh14GZsZySow5002l4Jr0b6%2Bm4eSyvpAn8lEzsx2QHo8RfUrlN%2BuPq4ksAAAAASUVORK5CYII%3D
