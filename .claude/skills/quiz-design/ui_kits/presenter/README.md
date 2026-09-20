# UI kit — Application présentateur

Desktop web app, 1280×800 design width. Click-through: **Mes quiz → Lancer** opens the lobby stage → **Démarrer** the live question → **Révéler la réponse** → **Question suivante** shows final results. **Nouveau quiz / crayon** opens the editor.

| File | Surface |
| --- | --- |
| `index.html` | Shell (SideNav + routing between app views and the projected stage) |
| `LibraryScreen.jsx` | Quiz library: search, tabs, quiz rows, empty state |
| `EditorScreen.jsx` | Three-pane question editor with per-question settings |
| `StageScreens.jsx` | The projected surface: `LobbyStage`, `QuestionStage` (live + revealed), `ResultsStage` |

Two distinct environments: the **app** is light (`--surface-page`, side rail, 15px body); the **stage** is `--stage-bg` with inverse ink and type sized for projection (question 40px, code 72px mono). Never mix the two chromes on one screen.
