Default container for every grouped block — quiz list rows, settings panels, result panels.

```jsx
<Card header="Réglages de la session" footer={<Button size="sm">Enregistrer</Button>}>…</Card>
<Card interactive selected>…</Card>
```

Never stack shadows: a card inside a card drops to `elevation={0}`.
