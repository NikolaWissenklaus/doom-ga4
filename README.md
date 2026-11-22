# DOOM no GA4

Roda o DOOM (versão shareware de 1993) dentro de uma **Exploração em formato livre** do Google Analytics 4, direto do console do navegador.

Não instala nada, não altera a propriedade e não envia nenhum dado para o GA.

<img width="1435" height="810" alt="image" src="https://github.com/user-attachments/assets/3b53ebbe-f907-4d1b-acb5-edb77600925c" />

## Como usar

1. No GA4, abra **Explorar › Formato livre**.
2. Abra o console do navegador (`F12` ou `Ctrl+Shift+J`).
3. Cole o conteúdo de [`doom_ga4.js`](doom_ga4.js) e aperte `Enter`.
   - Na primeira vez, o Chrome pede para digitar `allow pasting` (ou `permitir colar`) antes de colar.
4. Clique no jogo e aperte `Enter`.

Para não colar toda vez, salve o script em **DevTools › Sources › Snippets** e rode com `Ctrl+Enter`.

## Controles

| Tecla | Ação |
|---|---|
| Setas | andar e virar |
| `,` `.` | andar de lado |
| `Shift` | correr |
| `Ctrl` ou clique esquerdo | atirar |
| `Espaço` ou clique direito | abrir portas e acionar botões |
| `1` a `5` | trocar de arma |
| `Tab` | mapa |
| `Esc` | menu |
| tecla à esquerda do `1` | esconder e pausar (tecla do chefe) |

## Comandos no console

| Comando | O que faz |
|---|---|
| `doomGa4.fechar()` | fecha o jogo e remove o card |
| `doomGa4.pausar()` / `doomGa4.continuar()` | pausa e retoma |
| `doomGa4.reiniciar()` | reinicia o jogo sem baixar de novo |
| `doomGa4.eventos()` | mostra a contagem de eventos da tabela |

## Como funciona

- Baixa o `doom.wasm` (~6,8 MB, com o `doom1.wad` embutido) do jsDelivr. Se falhar, tenta o GitHub Pages do autor do port.
- Roda o jogo em WebAssembly e desenha num `<canvas>` dentro de um card no estilo do GA4, posicionado sobre a área da tabela da exploração.
- Fora de uma exploração, o card aparece centralizado e se move sozinho quando você abrir uma.
- Ao lado do jogo, uma tabela no formato do GA4 conta as teclas como eventos (`Ação` × `Eventos`).
- Funciona com o CSP do GA4 porque usa apenas `fetch`, WebAssembly e DOM (sem `innerHTML`, `eval` ou scripts externos).

## Requisitos

- Chrome ou Edge no desktop
- Acesso a `cdn.jsdelivr.net` ou `diekmann.github.io`

## Problemas comuns

| Problema | Solução |
|---|---|
| O teclado parou de responder | Clique no jogo de novo. |
| O card apareceu no lugar errado | Arraste pelas abas. Duplo clique devolve para o lugar. |
| O download foi bloqueado pela rede | Baixe o [`doom.wasm`](https://diekmann.github.io/wasm-fizzbuzz/doom/doom.wasm) e arraste o arquivo para o card. |
| O Chrome trocou de aba ao segurar `Ctrl` + número | Atire com o clique do mouse. |

## Limitações

- Sem som.
- Salvar o jogo provavelmente não funciona neste port.
- A tela trava por cerca de 1 segundo no início de cada fase (efeito de transição original do jogo).

## Créditos

- **DOOM**: id Software. Código-fonte liberado sob GPL ([id-Software/DOOM](https://github.com/id-Software/DOOM)).
- **Port para WebAssembly**: Cornelius Diekmann ([diekmann/wasm-fizzbuzz](https://github.com/diekmann/wasm-fizzbuzz)).
- **doom1.wad**: episódio shareware, de distribuição livre.

Projeto independente, sem vínculo com o Google ou com a id Software.

## Autor

Francisco Lucas / Chico / Nikola Wissenklaus
