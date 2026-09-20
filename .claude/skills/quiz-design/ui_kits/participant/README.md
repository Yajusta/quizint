# UI kit — Application participant

Mobile web, 390×780 viewport inside a plain frame (no device bezel art). Click-through: **Rejoindre → salle d'attente → (bouton de simulation) question → réponse → retour → classement**.

| File | Surface |
| --- | --- |
| `index.html` | Flow shell + the simulated "le présentateur démarre" step |
| `Screens.jsx` | `Phone` frame, `JoinScreen`, `WaitingScreen`, `QuestionScreen`, `FeedbackScreen`, `RankScreen` |

Rules specific to this surface: every tap target is ≥52px (`--control-h-lg`/`xl`); the join code input is mono, centred, 26px; the answer letters keep the same channel colours as the projected stage; waiting and feedback screens use the dark stage ground so the participant's phone visually matches the room.
