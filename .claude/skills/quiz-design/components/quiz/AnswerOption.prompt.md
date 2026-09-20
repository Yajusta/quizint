One answer choice. Options carry **no colour of their own** — the letter tile is grey at rest, so colour always means something:

| Phase | State | Reading |
| --- | --- | --- |
| Question | `default` | proposition, not chosen |
| Question | `selected` | this participant's choice (brand) |
| Réponse | `correct` | the right answer (green) |
| Réponse | `wrong` | chosen and wrong (red) |
| Réponse | `muted` | neither chosen nor correct |

```jsx
<AnswerOption letter="A" size="lg" onClick={pick}>La Seine</AnswerOption>
<AnswerOption letter="B" state="selected">La Loire</AnswerOption>
<AnswerOption letter="B" state="correct" distribution={58}>La Loire</AnswerOption>
```

On the presenter stage after a reveal, show `distribution` on every option and set everything that isn't the answer to `muted`.
