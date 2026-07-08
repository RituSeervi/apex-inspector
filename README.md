# ⚡ APEX Inspector

A free Chrome/Edge extension for Oracle APEX developers. One click on any
running APEX page gives you a floating panel with:

- **Items tab** — every page item with its **live value**
  - Click the item **name** → copies it to clipboard
  - Click the **value** → edit it inline (fires a real change event, so your
    Dynamic Actions trigger — perfect for testing cascades)
  - Hidden items are labeled
- **Regions tab** — every region that has a Static ID
  - Hover a row → the region **flashes on the page** so you can see which is which
  - Click the name → copies the Static ID (ready for `apex.region("...")`)
- **Header** — App ID · Page ID · Session, always visible
- **Copy all as JSON** — snapshot the entire page's item state for a bug report
- Filter box, refresh button, draggable panel

No server-side install. Nothing touches your APEX instance. It only reads the
page through the documented `apex.item` / `apex.region` / `apex.env`
JavaScript APIs — the same calls you'd type in the console.

## Install (30 seconds)

1. Download / unzip this folder
2. Open `chrome://extensions` (or `edge://extensions`)
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** → select this folder
5. Open any running APEX app page and click the **APEX Inspector** icon

Click the icon again to close the panel.

