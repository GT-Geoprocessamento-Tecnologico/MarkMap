```markdown
## Desenvolvimento nativo (WebNative + Capacitor)

- WebNative **não** altera a execução do Capacitor; ele apenas oferece uma
**workflow** que facilita a sincronização com o projeto (`cap sync` + `cap
open`). O `capacitor.config.json` continua apontando `webDir: "dist"`.

### Passos para desenvolvedores

1. **Abrir VS Code** no diretório raiz (`.vscode/extensions.json` recomenda o
   *WebNative*).
2. **Selecionar** *Play* no *Launch Menu* → *admin* para iniciar o Vite dev
   servidor em `http://localhost:5173`.
3. **Seleção do dispositivo**: vá em *Run → Android* para sincronizar a
   aplicação no Android emulado ou físico usando os comandos:
   ```bash
   pnpm --filter admin exec cap sync android
   pnpm --filter admin exec cap open android
   ```
4. O *online preview* continua o mesmo que antes (`vite preview`).
5. Para debugar a aplicação native, use o *Launch → Android* (que executa `cap
   sync` e abre o projeto no Android Studio via `cap open`).

> O fluxo WebNative **não cria** um projeto capacitado separado nem introduz
> dependências extras no bundle. Ele funciona apenas como ferramenta de
> desenvolvimento.
```

*Escreva a documentação em `docs/native-development.md` se desejar*, mas não é
obrigatório.|write