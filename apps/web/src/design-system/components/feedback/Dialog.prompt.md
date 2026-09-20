Confirmations and short forms. Actions go in `footer`, cancel on the left of confirm.

```jsx
<Dialog title="Terminer la session ?" description="Les participants verront le classement final."
  footer={<><Button variant="ghost">Annuler</Button><Button variant="danger">Terminer</Button></>} onClose={close} />
```
