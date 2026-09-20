Lobby / présence list. Pass the row index as `seed` so avatar tints alternate across the brand/graphite set.

```jsx
{players.map((p,i) => <PlayerChip key={p} name={p} seed={i} tone="dark" />)}
```
