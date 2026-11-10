# Bolso-16

Sampler e sequenciador de bolso para o iPhone Duo, instalado como PWA. Dezesseis sons por kit: os sons 1–8 são melodia e tocam num teclado de sete acordes com joystick; os sons 9–16 são batida e amostras e tocam nos pads. Tem sequenciador de 16 padrões com passo rico, polimetria e progressão de acordes, gravação ao vivo, efeitos de performance, fita, looper de notas (PERF) e gravação pelo microfone com CHOP.

Não usa código do SLOOP nem marcas, nomes ou artes da Teenage Engineering.

## Usar

- **No iPhone:** abra o endereço do GitHub Pages no Safari, toque em Compartilhar › Adicionar à Tela de Início. Depois da primeira visita o app abre offline.
- **No computador:** `npm run servir` e abra `http://127.0.0.1:8016/`. Não há build: é `index.html` com módulos em `app/`.

## Testes

```
npm install
npm run teste              # T1–T17 (o T4 leva 30 s)
npm run teste -- --rapido  # T4 em 6 s
npm run teste -- --prints  # também salva as telas em testes/prints/
npm run teste -- --atualizar   # regrava o hash do T1 em testes/golden.json (só de propósito)
```

`teste.html` roda T1–T14 e T17 direto no navegador, inclusive no iPhone (abra `…/teste.html` e toque em Rodar testes). T15 e T16 precisam do Playwright. O executor usa o WebKit se ele estiver instalado (`npx playwright install webkit`) e, se não, o Chrome do sistema. O golden do T1 é guardado por motor de navegador.

O resultado da última execução fica em `testes/resultado.json`.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html`, `styles.css` | Casca e todos os tokens visuais |
| `app/teoria.js` | Escalas, acordes dos 7 graus, variações do joystick, transposição tonal, arp |
| `app/dados.js` | Esquema versionado, kit de fábrica, padrão demo, migração |
| `app/motor.js` | Grafo de áudio: vozes, inserts, duck, FX, fita, FILT DJ, dust, limitador |
| `app/relogio.js` | Agendamento antecipado, `agendaPasso` (único caminho dados → som), REC, arp/REPT |
| `app/perf.js` | Looper de notas de 4 faixas |
| `app/amostras.js`, `app/fita-worklet.js` | Gravação, CHOP, worklets da fita e do gravador |
| `app/banco.js` | IndexedDB |
| `app/shader.js` | Visual de ferrofluido (WebGL, com fallback em canvas 2D) |
| `app/nucleo.js`, `app/ui.js`, `app/telas.js`, `app/dom.js` | Estado e ações, interface |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA |
| `teste.html`, `testes/` | Testes, golden, backup de versão anterior, tabela de funções |

## Função → onde fica

Esta tabela é gerada de `testes/funcoes.json`, o mesmo arquivo que o T15 usa para conferir que cada linha é alcançada em no máximo dois toques a partir da sua aba, sem segurar nada.

| Função | Lugar |
|---|---|
| PLAY/STOP, REC | Pílula |
| BPM −/+ (60–240), TAP, Swing −/+ | Folha Tempo |
| Contagem antes do REC | Folha Tempo |
| Metrônomo Desl. · No REC · Sempre | Folha Tempo |
| REPT ao segurar o pad | Folha Tempo |
| Volume do metrônomo, fade de punch-in, calibração de latência | Biblioteca › Config |
| Desfazer volta (até 8), Borracha | Linha do REC |
| Fill (linha do REC) | Linha do REC |
| Fill (Tocar › FX) | Tocar › FX |
| Fill (Sequência) | Sequência |
| Padrões 1–16 | Sequência (fileira) |
| Lista de sons do padrão, M e S, Mostrar os 16 sons | Sequência |
| Ver Página · Tudo; Pág 1 · Pág 2…; Seguir | Sequência |
| Comprimento 8/16/32/64 | Botão “N passos” na Sequência e Editar › Comprimento |
| Copiar padrão para…, Limpar padrão, Cadeia Montar · Desfazer · Nova, Tocar em cadeia | Folha Editar padrão |
| Comprimento e Divisão do som, Deslocar notas, Copiar som para…, Limpar som, Conduz a harmonia (PROG), Segue a harmonia | Folha Som na sequência |
| Repetir, Adiantar/atrasar, Quando tocar, Ligar à nota anterior, Efeito melódico, Como segue a harmonia, Som só neste passo, Trocar pelo acorde atual | Folha Passo |
| Teclado de 7 graus + joystick | Tocar (sons 1–8) |
| Estilos Acorde · Strum · Arp · Nota | Tocar, logo abaixo do acorde |
| Tom, escala, inversão, oitava, velocidade do strum, ajustes do arp | Folha Tom e estilo |
| Pads 4×4 | Tocar (sons 9–16 + fatias) |
| 15 FX + “sem”, segurar/travar, gravar no padrão, apagar FX, FILT DJ | Tocar › FX › Efeitos |
| Fita (vel, início, loop, filt) | Tocar › FX › Fita |
| Looper PERF | Tocar › Perf |
| Fonte Synth · Amostra · CHOP · Textura, gravar do microfone, importar | Som › Fonte |
| Filtro e envelope, Insert, Estilo de voz, Duração/Drone, Ligado a outro som, Volume/Pan | Som |
| Duck, Saída (limitador + LIM, Dust, volume master) | Som › Master |
| Kits | Biblioteca › Kits |
| Padrões salvos | Biblioteca › Padrões |
| Amostras | Biblioteca › Amostr |
| Backup exportar/importar | Biblioteca › Backup |
| Ajuda | Biblioteca › Ajuda |

## Decisões onde a spec deixava escolha

- **Pads 4×4:** as duas fileiras de baixo são os sons 9–16; as duas de cima são as fatias (CHOP) ou oito afinações do som escolhido. Com mais de oito fatias aparece o seletor `Fatias 1–8 · 9–16`.
- **16 teclas de FX:** loop 4/3/2/1, stutter, retrigger, 6/8, oitava ↑, oitava ↓, uníssono, reverso, scratch, filtro varrido, eco e gate somam 15, mais "Sem". Não sobrou tecla para três efeitos extras.
- **Acordes em escalas de 5 ou 6 notas** (Pent, mPent, Blues) saem da escala-mãe de sete notas; o estilo Nota e a Rampa usam a escala real.
- **Variação ↙:** `6` nos acordes maiores e `sus2` nos menores e diminutos.
- **"Segue a harmonia"** transpõe por graus da escala quando a nota está na escala (C E G sobre o vi vira A C E) e por semitons quando não está.
- **REC ao vivo num som que segue a harmonia** guarda a nota já "destransposta", para o playback repetir o que você ouviu ao tocar.
- **Duração das notas gravadas** é a do som (Som › Duração) ou a do passo (folha Passo), não o tempo que a tecla ficou apertada.
- **Limitador:** além do `DynamicsCompressor` pedido, há um teto fixo em −0,54 dBFS depois dele, porque o compressor dos navegadores aplica ganho de compensação.
- **Fita** roda num AudioWorklet pequeno; o agendamento continua em `setTimeout` + lookahead.
- **PERF › Salvar** junta as faixas com conteúdo num padrão livre e o põe no fim da cadeia. **Reamost.** renderiza as faixas offline, no compasso, e põe o áudio no pad 16.
- **Backup** é um `.json` com as amostras em base64 (sem `.zip`).
