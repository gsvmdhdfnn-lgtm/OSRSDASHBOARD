# Task Organiser

A small, calm task list that runs entirely in your web browser. It's plain HTML, CSS and JavaScript, with no framework, no build step, no account and no internet services.

## What it does

- **Add** a task by typing a title and pressing **Add task** or the Enter key. Blank titles are rejected with a message.
- **Complete** a task by ticking its checkbox. Untick it to move it back to outstanding.
- **Filter** the list with **All**, **Outstanding** and **Completed**. Each filter shows a count.
- **Delete** a task with the bin button. This happens straight away and can't be undone.
- **Keep** your tasks when you refresh or reopen the page, using the browser's local storage.

Task titles are always shown as plain text. If you type something like `<b>hello</b>`, you'll see exactly those characters. The browser never runs it as code.

## Where your tasks are saved

Tasks are saved **only in this browser, on this device**:

- They are not backed up, synced or sent anywhere.
- A different browser or device won't see them.
- They will be lost if you clear this browser's history or site data, if the browser clears storage itself, or if you use a private window.

If the browser blocks saving, the app shows a warning at the bottom of the page.

## How to open it

**On a computer:** download or clone this folder, then double-click `index.html`. It opens in your default browser. There is nothing to install.

**On a phone or iPad:** a phone can't easily open a file straight from a folder, so the page needs to be served. Two options:

1. *Same Wi-Fi as your computer:* in this folder on the computer, run `python3 -m http.server 8000`. Then on the phone, open `http://<your-computer's-local-IP>:8000`.
2. *Host it:* put the folder on any static web host, such as GitHub Pages.

Tasks saved at one address (for example the local file, or a hosted URL) are separate from tasks saved at another.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure: form, filters, list, empty state and storage note |
| `styles.css` | Layout and look, including responsive spacing, dark mode, focus outlines and 44px touch targets |
| `app.js` | Behaviour: add, toggle, filter, delete, save and load |

## Accessibility notes

- Every control has a visible or screen-reader label. Delete buttons say which task they delete.
- Keyboard focus is clearly outlined. Focus is kept in a sensible place after a task is ticked or deleted.
- Changes such as "Added …" and "Deleted …" are announced to screen readers.
- Buttons and checkboxes have touch targets at least 44 × 44 pixels.

## History

This repository previously held a 1-to-1 session booking app. It's still in git history. The last booking-app commit is `b59bbc68cd7f79ec809d560af11a0b8557918d65`, and GitHub's `main` branch kept it at merge commit `b367e0b754fee5ec79ab11694c422603fd669281`. To restore it, run `git checkout b59bbc6 -- .` or create a branch from that commit.
