# Bolso-16 · relatório final

## 1. Links

**Não publicado.** A sessão não consegue criar `itowers/Bolso16-Fable` (só enxerga repositórios que já existem) e por isso não há link do GitHub Pages. O repositório está completo localmente, com 4 commits, e vai junto em `Bolso16-Fable.zip`. Assim que o repositório vazio existir no GitHub, é um `git push` e ligar o Pages na branch `main`.

## 2. Testes

Rodados no **Chrome 153 (headless)**. O WebKit do Playwright não pôde ser baixado neste ambiente, então nada aqui foi medido no Safari.

| Teste | Resultado | Números |
|---|---|---|
| T1 Hash de áudio | OK | SHA-256 `0d54cdf5a3928f13…` igual ao golden em 5 execuções seguidas |
| T2 Timing | OK | 33 notas, erro máx **0,930 ms** (limite 1 ms); atraso fixo do limitador 6,5 ms |
| T3 Polimetria | OK | A (16) e B (12) coincidem no passo 49, erro 0 s |
| T4 Jitter ao vivo | OK | 30 s, 241 passos, jitter máx **0,0000 ms**, antecedência mín 39,7 ms, 0 passos com menos de 10 ms, shader WebGL ligado |
| T5 Passo rico | OK | ratchet 3 = 3 ataques; tie = 0; `1:2` nas voltas 1, 3, 5; FILL só com fill; 50% da fila = o que soou |
| T6 Latência | OK | com 40 ms simulados, toques de −50 a +50 ms caem no passo certo |
| T7 DUCK e limitador | OK | −21,7 dB após o bumbo, 0,00 dB após a soltura; 16 sons no máximo: pico −0,68 dBFS |
| T8 CHOP | OK | 8 fatias, erro máx de início 0,02 ms |
| T9 Persistência | OK | 18 grupos de campos; recarga real do app; exportar/zerar/importar; backup v1 toca igual (hash idêntico) |
| T10 CPU | OK | 8 compassos, 16 sons, 1841 notas, 15 FX + fita + dust + inserts: **17,6%** da duração |
| T11 Acordes | OK | C Dm Em F G Am Bdim; ↗ dominante nas 7; 1ª inversão de C = E G C |
| T12 Gravar acorde | OK | C7 gravou [60,64,67,70] só no passo 5, com swing 30% |
| T13 Efeitos melódicos | OK | Quebra = C E G B; Rampa ↑ 6 na escala; Glide 372 Hz no meio; Salto toca 1–8 e o padrão troca no passo 33 |
| T14 Progressão e Arp | OK | baixo C F G C; `ignora` C C C C; `quant` no acorde; arp C E G C' E' G', erro 0,091 ms |
| T15 Interface | OK | 3 tamanhos × 27 estados; 3563 alvos ≥ 44 px; contraste mín 4,59:1; 32 linhas da tabela em ≤ 2 toques; dobrar sem perder estado |
| T16 PWA | OK | manifest válido, service worker com 21 arquivos, abre offline |
| T17 Padrões e cadeia | OK | troca espera o fim; cadeia 16 › 32; esticar duplica; encurtar não perde |

Dois avisos sobre esses números:
- **T4 falhou uma vez** numa execução anterior (um passo agendado com 7,8 ms de antecedência), antes de eu fazer o teste compilar o shader antes de começar a medir. Depois disso passou em 8 execuções seguidas. Não levei o agendamento para AudioWorklet.
- **T2 passa com folga pequena** (0,93 de 1 ms). O erro vem da detecção de ataque no chimbal de ruído, não do agendamento (o T14 mede 0,091 ms com um clique limpo).

## 3. Cenários manuais

Foram dirigidos por script no app real, com áudio em tempo real no Chrome headless. **Ninguém ouviu o resultado**: os números abaixo são estado e nível de sinal, não julgamento de som.

1. **Beat do zero:** REC mostrou `REC ▸ 4 3 2`; bumbo ao vivo caiu nos passos 1, 5, 9, 13; overdub de caixa em 5 e 13 sem apagar o bumbo; chimbal com REPT 1/16 preencheu os 16 passos; `Desfazer volta` tirou o tom gravado na volta; Borracha segurando a caixa por um compasso apagou só a caixa.
2. **Progressão:** I–V–vi–IV gravados nos passos 1, 9, 17, 25 de um padrão de 32; baixo em Nota soou C, G, A, F; arp ↑↓ gravou uma nota por semicolcheia; atraso dos passos ímpares 18,8 ms (esperado 18,75).
3. **Polimetria e fill:** chimbal com comprimento 12 pela folha Som na sequência; caixa com ratchet 3×; passo `FILL` com 4× só tocou com Fill segurado (visor `FILL`).
4. **Microfone e CHOP:** gravou 2,75 s do microfone falso do Chrome; Ataques achou 5 marcas nesse sinal (não 8), então usei Grade 8; Distribuir pediu confirmação e pôs 8 fatias nos pads; REC ao vivo de 4 fatias gravou notas 60–63.
5. **PERF:** F1 gravou e fechou no compasso; F2 em 1 compasso com overdub; Desf e Refaz por camada; ×2 armado e aplicado no "1"; mute e volta da F3 no "1"; FB 70% por 4 voltas levou a camada antiga a 0,24; Salvar criou o P2 e o pôs na cadeia; Reamost gerou 8,00 s de áudio no pad 16. No meu script a F1 fechou em 4 compassos em vez de 2, por atraso do próprio script ao apertar.
6. **Cadeia, trava, FX, offline:** cadeia 1 › 2 › 1 montada pelo banner; mexer no Corte com REC gravou trava só nos passos do bumbo e deixou o valor base intacto; Stutter com "Gravar no padrão" escreveu `fx` em 5 passos; depois de fechar e abrir offline, cadeia, trava, FX e BPM voltaram idênticos.

Também verifiquei por script: fita (Parada zera o nível e volta ao soltar), textura e Freeze, strum, Drone e Calar, joystick travando e soltando, TAP, calibração.

## 4. Prints

Em `testes/prints/`: as 4 abas nos 3 tamanhos (12 imagens), mais pads, FX, Perf, Fonte, Master, Config e as 5 folhas em cada tamanho (45 no total). Folhas de contato: `_abas-externo.png`, `_abas-interno.png`, `_abas-largo.png`, `_folhas-externo.png`.

## 5. Tabela função → onde ficou

Está no `README.md`, gerada de `testes/funcoes.json`, o mesmo arquivo que o T15 usa. Todas as linhas ficaram no lugar pedido. Dois ajustes de rótulo: a seção de amostras da Biblioteca aparece como `Amostr`, e Configurações como `Config`.

## 6. Desvios e simplificações

- **Não publicado no GitHub nem no Pages** (bloqueio acima).
- **Commits:** 4, não um por fase. Construí as fases juntas e só então fechei os testes.
- **Testes só no Chrome**, não no WebKit.
- **Pads 4×4:** fileiras de baixo = sons 9–16; fileiras de cima = fatias ou 8 afinações do som escolhido. A spec dizia tanto "pad = som" quanto "fatias nos pads"; essa foi a leitura mais simples que atende às duas.
- **FX:** os 15 listados + "Sem" ocupam as 16 teclas; não há os "3 à escolha". Gate e filtro varrido só agem com o padrão tocando.
- **DUST:** bitcrush + ruído de vinil; sem redução de taxa de amostragem.
- **Backup:** só `.json`, sem `.zip`.
- **PERF › Salvar** junta as faixas num padrão só (não salva uma faixa isolada). **Reamost** vai sempre para o pad 16.
- **Duração da nota gravada** vem do som ou do passo, não do tempo que a tecla ficou apertada.
- **Teto de 4 vozes por som** (a mais antiga cede), para segurar a CPU.
- **Limitador:** `DynamicsCompressor` + teto fixo em −0,54 dBFS. O `LIM` do visor é estimado pelo pico antes do limitador.
- **Gravação pelo microfone** exige AudioWorklet; sem ele, o app avisa e segue.
- **Celular deitado** (844×390) cai no layout largo, que foi desenhado para ≥ 500 px de altura; não testei esse tamanho.
- **Fora:** MIDI, luzes, vídeo, nuvem e os modos EXT/CHROM/BORROW/OG, como pedido.

## 7. Riscos no iPhone real

- **Áudio em segundo plano:** o iOS suspende o `AudioContext` ao trocar de app. O app retoma no próximo toque e mostra `Toque para retomar o áudio`, mas o padrão não continua tocando com a tela bloqueada.
- **Microfone no PWA:** o iOS pode pedir permissão de novo a cada abertura do app instalado, e versões antigas não entregam `getUserMedia` em standalone. Testar primeiro.
- **Armazenamento:** peço `storage.persist()`, mas o iOS pode apagar o IndexedDB de um PWA pouco usado. Exportar backup de vez em quando.
- **`outputLatency`:** o Safari costuma não informar; o app cai em `baseLatency` e a calibração manual passa a ser necessária, principalmente com fone Bluetooth.
- **Limites dos testes a rever no aparelho:** T4 (antecedência mínima com o shader ligado; se cair abaixo de 10 ms, subir o lookahead de 120 para 150 ms), T10 (o Chrome de desktop é mais rápido que o aparelho; 17,6% aqui pode ser bem mais lá) e o golden do T1, que precisa ser gerado uma vez no WebKit.
- **WebGL ao dobrar:** tratei perda e restauração de contexto, mas só simulei a troca de tamanho, não a dobra física.

## 8. Autoavaliação

| Critério | Nota | Por quê |
|---|---|---|
| Fidelidade à spec | 7 | Tudo da tabela existe e é testado, mas há as simplificações do §6 e a entrega não está publicada |
| Precisão de tempo | 9 | Jitter de agendamento 0; polimetria sem deriva; falta medir no aparelho |
| Som do kit de fábrica | 5 | Sintetizado e variado, mas não ouvi; o chimbal varia cerca de 11 dB de um toque a outro |
| "Nada escondido" | 9 | 32 linhas em ≤ 2 toques nos 3 tamanhos; segurar só em REPT, Borracha, Fill e FX |
| Layout no dobrável | 8 | Sem estouro, quebra ou alvo pequeno nos 3 tamanhos; não testei celular deitado nem o aparelho |
| Robustez offline | 8 | Abre offline e restaura estado e amostras; atualização do service worker não foi testada de ponta a ponta |
