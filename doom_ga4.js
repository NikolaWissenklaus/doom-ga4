/*
 * ============================================================================
 *  doom_ga4.js - DOOM rodando numa Exploração em formato livre do GA4
 * ============================================================================
 *
 *  Autor ......: Francisco Lucas / Chico / Nikola Wissenklaus
 *  Criado em ..: 23/09/2022
 *  Atualizado .: 20/11/2026
 *
 *  Resumo pra quem tem pressa (ou seja, todo mundo que usa GA4):
 *  o DOOM de 1993, versão shareware, rodando dentro de uma Exploração em
 *  formato livre. Onde moravam as Dimensões e as Métricas agora moram
 *  demônios. A pergunta nunca foi "precisa?". A pergunta sempre foi "roda?".
 *
 *  Como usar:
 *    1. GA4 > Explorar > Formato livre (uma exploração nova ou uma sua)
 *    2. F12 ou Ctrl+Shift+J pra abrir o Console
 *    3. Cola este arquivo inteiro e aperta Enter
 *    4. Clica no jogo e aperta Enter
 *
 *  Controles:
 *    setas ...... anda e vira             Ctrl ou clique ....... atira
 *    Espaço ..... abre porta              botão direito ........ abre porta
 *    , e . ...... anda de lado            Shift ................ corre
 *    1 a 7 ...... troca de arma           Tab .................. mapa
 *    Esc ........ menu                    Enter ................ confirma
 *
 *    Tecla do chefe: a que fica à esquerda do 1 (aspas/crase). Esconde tudo
 *    e pausa na hora. Clicar na aba "Formato livre 1" do card também.
 *
 *  Pra fechar: o X do card, ou doomGa4.fechar() no console.
 *
 *  Créditos (de quem trabalhou de verdade):
 *    - id Software: o DOOM, e o código liberado em GPL (linuxdoom-1.10)
 *    - Cornelius Diekmann: o port pra WebAssembly sem Emscripten
 *      https://github.com/diekmann/wasm-fizzbuzz (o doom.wasm vem de lá)
 *    - O doom1.wad embutido é o episódio shareware, que a própria id liberou
 *      pra distribuir de graça em 1993. Pode mostrar pro jurídico.
 *    - Eu: as piadas. Ninguém pediu.
 *
 *  Nada daqui vai pro Google Analytics. A tabela do card é calculada no seu
 *  navegador e morre quando você fecha a aba, igual meus planos de academia.
 *
 *  Licença: faz o que quiser. Se o chefe aparecer, você nunca viu este arquivo.
 *
 *  Histórico (versão sem palavrão):
 *    23/09/2022  v0.1  Nasceu. Era um quadrado vermelho escrito DOOM em cima do
 *                      Universal Analytics. Tecnicamente, rodava.
 *    01/07/2023  v0.4  O UA parou de coletar dados. Descanse em paz. Mudei pro
 *                      GA4 junto com o resto do planeta.
 *    2024        v1.0  DOOM de verdade, em WebAssembly, no relatório de Tempo Real.
 *    2025        v1.6  Loop preso em 35 tics/s (antes o notebook virava
 *                      aquecedor) e plano B de arrastar o .wasm pra tela.
 *    20/11/2026  v2.0  Mudou-se pra Exploração em formato livre. Lá tem mais
 *                      espaço e ninguém estranha mais uma tabela esquisita.
 * ============================================================================
 */

(async () => {
  'use strict';

  // Colou duas vezes? Acontece nas melhores famílias. Fecha o anterior antes.
  if (window.doomGa4 && typeof window.doomGa4.fechar === 'function') {
    try { window.doomGa4.fechar(); } catch (e) { /* já tava meio morto mesmo */ }
  }

  /* ==========================================================================
   *  Coisas que dá pra mexer sem quebrar nada (acho)
   * ======================================================================== */

  // De onde vem o doom.wasm (uns 6,8 MB, com o doom1.wad embutido dentro).
  // O jsDelivr tá preso num commit, então o arquivo não muda por baixo dos panos.
  // Se ele cair, tenta direto no GitHub Pages do autor do port.
  const ESPELHOS = [
    'https://cdn.jsdelivr.net/gh/diekmann/wasm-fizzbuzz@541cd0102992f8761ad4e9f02206bf2f44865d30/doom/doom.wasm',
    'https://diekmann.github.io/wasm-fizzbuzz/doom/doom.wasm',
  ];

  const LARGURA = 640;            // o port entrega o 320x200 original já dobrado
  const ALTURA = 400;
  const PAGINAS_MEMORIA = 108;    // 108 x 64 KB, igual ao port original (o módulo pede no mínimo 102)
  const TICS_POR_SEGUNDO = 35;    // o DOOM pensa a 35 Hz desde 1993 e não vai mudar por nossa causa
  const LARGURA_TABELA = 264;     // 260 cortava o "Andar de lado" e 270 ficou feio

  const AZUL = '#1a73e8';
  const VERDE = '#188038';
  const CINZA = '#5f6368';
  const LINHA = '#dadce0';
  const TEXTO = '#202124';
  const FONTE = '"Google Sans", Roboto, Arial, sans-serif';
  const ESTILO_LOG = 'color:#c62828;font-weight:bold';

  // A parte mais importante do projeto inteiro
  const FRASES_DE_CARREGAMENTO = [
    'Baixando o inferno...',
    'Coletando eventos do inferno...',
    'Processando os dados. No GA4 de verdade levaria até 48 horas...',
    'Quase lá. Ignorando o (not set)...',
  ];

  // O GA4 troca o nome das classes toda lua cheia, então eu acho a exploração
  // pelo TEXTO dos painéis e da aba. É gambiarra? É. Funciona? Até o próximo deploy deles.
  const TITULO_DE_PAINEL = /^(variables|variáveis|settings|tab settings|configurações|configurações da guia|configuración|configuración de la pestaña)$/i;
  const NOME_DE_ABA = /^(free[\s-]?form|formato livre|forma livre|forma libre)\s+\d+$/i;

  /* ==========================================================================
   *  Os números do teclado vêm primeiro porque foram o que mais deu trabalho
   * ======================================================================== */

  // teclas do DOOM, copiadas do doomdef.h (sim, conferi duas vezes)
  const K = {
    DIREITA: 0xae, ESQUERDA: 0xac, CIMA: 0xad, BAIXO: 0xaf,
    ESC: 27, ENTER: 13, TAB: 9, BACKSPACE: 127, ESPACO: 32, PAUSE: 0xff,
    SHIFT: 0x80 + 0x36, CTRL: 0x80 + 0x1d, ALT: 0x80 + 0x38,
    F1: 0x80 + 0x3b,
  };

  // A dimensão "Ação" da tabela. Cada tecla vira um evento, do jeitinho que o
  // GA4 faria se alguém tivesse coragem de configurar isso no GTM.
  const ACAO_DA_TECLA = new Map([
    [K.CTRL, 'Atirar'],
    [K.CIMA, 'Andar'], [K.BAIXO, 'Andar'],
    [K.ESQUERDA, 'Virar'], [K.DIREITA, 'Virar'],
    [K.ESPACO, 'Abrir porta'],
    [44, 'Andar de lado'], [46, 'Andar de lado'], [K.ALT, 'Andar de lado'],
    [K.SHIFT, 'Correr'],
    [K.TAB, 'Olhar o mapa'],
    [K.ESC, 'Abrir o menu'],
    [K.ENTER, 'Confirmar'],
  ]);

  // Os cheats clássicos. O DOOM cuida da parte do jogo, aqui é só a fofoca.
  const CHEATS = {
    iddqd: 'IDDQD: modo Deus ligado. Agora você é Administrador da propriedade. (Não é.)',
    idkfa: 'IDKFA: todas as armas e todas as chaves. Inclusive a da sala do servidor.',
    idfa: 'IDFA: todas as armas, nenhuma chave. Tipo acesso de Leitor.',
    idclip: 'IDCLIP: atravessando paredes, igual cookie de terceiro antigamente.',
    idspispopd: 'IDSPISPOPD: atravessando paredes, na versão difícil de digitar.',
  };

  /* ==========================================================================
   *  Estado. Variável solta mesmo: é script de console, não é core bancário.
   * ======================================================================== */
  let inferno = null;            // a instância do wasm. Sim, chamei de inferno.
  let modulo = null;             // módulo compilado, pra reiniciar sem baixar tudo de novo
  let inicio = 0;                // performance.now() de quando o jogo ligou
  let rafId = 0;
  let relogio = 0;
  let timerFofoca = 0;
  let ultimoTic = -1;
  let ultimoPasso = 0;
  let confioNoRelogioDoDoom = true;
  let pausado = false;
  let minimizado = false;
  let arrastado = false;         // depois que arrastam o card eu paro de mexer nele, prometo
  let fechado = false;
  let jaFocou = false;
  let quadros = 0;
  let fps = 0;
  let digitado = '';             // últimas letras, pra pegar cheat
  let pistas = [];               // elementos que entregam onde está a exploração
  let ultimaProcura = 0;
  let ultimaArea = '';
  let achouExploracao = null;    // null = ainda nem olhei
  const teclasApertadas = new Set();
  const eventos = new Map();     // ação -> quantidade. Retenção de dados: até fechar a aba
  const abortador = new AbortController();
  const desfazer = [];           // tudo que o fechar() precisa limpar

  /* ==========================================================================
   *  Umas ferramentinhas
   * ======================================================================== */
  const log = (...coisas) => console.log('%c[doom-ga4]', ESTILO_LOG, ...coisas);
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const numero = (n) => n.toLocaleString('pt-BR');

  // Milissegundos "desde que o DOOM ligou", começando em 1000 de propósito:
  // - o I_GetTime de 1993 usa "segundo == 0" como "ainda não inicializei". Se o
  //   relógio começar no zero, ele volta 1 s no meio do jogo, e se isso cair bem
  //   na hora de derreter a tela, o while do efeito dá umas 4 bilhões de voltas.
  // - passar o performance.now() cru estoura a conta de 32 bits lá dentro se a
  //   aba do GA4 estiver aberta desde segunda-feira.
  const relogioDoJogo = () => performance.now() - inicio + 1000;

  // cria elemento já com estilo. Nada de innerHTML: o Google adora apertar o
  // CSP e eu não quero descobrir isso numa sexta-feira às 18h.
  function el(tag, estilo, texto) {
    const e = document.createElement(tag);
    if (estilo) Object.assign(e.style, estilo);
    if (texto != null) e.textContent = texto;
    return e;
  }

  function ouvir(alvo, evento, fn, opcoes) {
    alvo.addEventListener(evento, fn, opcoes);
    desfazer.push(() => alvo.removeEventListener(evento, fn, opcoes));
  }

  /* ==========================================================================
   *  O card. Vestido de exploração pra passar despercebido na reunião.
   * ======================================================================== */
  const card = el('div', {
    position: 'fixed', zIndex: '2147483000',   // o maior número que coube sem o GA4 passar por cima
    left: '24px', top: '80px',
    background: '#fff', color: TEXTO, fontFamily: FONTE, fontSize: '14px',
    borderRadius: '8px', overflow: 'hidden', boxSizing: 'content-box',
    boxShadow: '0 1px 2px 0 rgba(60,64,67,.3), 0 2px 6px 2px rgba(60,64,67,.15)',
  });
  card.id = 'doom-ga4';

  // A fileira de abas, igual a da exploração. "Formato livre 1" é a tabela de
  // verdade (clicar nela esconde o DOOM). "DOOM 1" é a que importa.
  const abas = el('div', {
    display: 'flex', alignItems: 'stretch', height: '48px', padding: '0 8px',
    borderBottom: `1px solid ${LINHA}`, cursor: 'move', userSelect: 'none',
  });
  const abaDeles = aba('Formato livre 1', false, 'Volta pra tabela de verdade (o DOOM espera pausado)');
  const abaNossa = aba('DOOM 1', true, 'Essa aqui é a boa');
  const abaMais = aba('+', false, 'Um DOOM por exploração. Não é limite do GA4, é bom senso.');
  // o escudinho verde de qualidade dos dados. Aqui é sempre 100%, diferente da vida real.
  const selo = el('div', {
    display: 'flex', alignItems: 'center', padding: '0 8px', flex: '0 1 auto', minWidth: '0',
    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: VERDE, fontSize: '12px',
  }, '✓ 100% dos demônios');
  selo.title = 'Esta exploração se baseia em 100% dos demônios disponíveis. Sem amostragem, sem limite de privacidade.';
  const botaoTelaCheia = botao('⛶', 'Tela cheia (segure Esc pra sair)', () => telaCheia());
  const botaoMinimizar = botao('–', 'Esconder e pausar', () => minimiza());
  const botaoFechar = botao('×', 'Fechar e voltar a trabalhar', () => fechar());
  abas.append(abaDeles, abaNossa, abaMais, el('div', { flex: '1' }), selo, botaoTelaCheia, botaoMinimizar, botaoFechar);

  const corpo = el('div', { display: 'flex', gap: '16px', padding: '12px 16px 8px', alignItems: 'flex-start' });

  // palco = onde o jogo aparece
  const palco = el('div', {
    position: 'relative', flex: 'none', background: '#000', borderRadius: '4px', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  const tela = el('canvas', { display: 'block', imageRendering: 'pixelated', outline: 'none', cursor: 'crosshair' });
  tela.width = LARGURA;
  tela.height = ALTURA;
  tela.tabIndex = 0;
  const ctx = tela.getContext('2d');

  // aviso grandão no meio (baixando, deu ruim, etc)
  const aviso = el('div', {
    position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '24px',
    background: 'rgba(0,0,0,.75)', color: '#fff', textAlign: 'center',
    fontSize: '15px', lineHeight: '22px', whiteSpace: 'pre-line',
  });
  const avisoTexto = el('div');
  const avisoBotao = el('button', {
    display: 'none', padding: '8px 20px', border: 'none', borderRadius: '18px',
    background: AZUL, color: '#fff', fontFamily: FONTE, fontSize: '14px', fontWeight: '500', cursor: 'pointer',
  });
  avisoBotao.type = 'button';
  aviso.append(avisoTexto, avisoBotao);

  // pílula de "clica aqui", fica embaixo pra não tapar a demo rodando atrás
  const pilula = el('div', {
    position: 'absolute', left: '50%', bottom: '14px', transform: 'translateX(-50%)',
    padding: '6px 14px', borderRadius: '16px', background: 'rgba(32,33,36,.85)', color: '#fff',
    fontSize: '13px', whiteSpace: 'nowrap', pointerEvents: 'none', display: 'none',
  }, 'Clique aqui e aperte Enter pra jogar');
  palco.append(tela, aviso, pilula);

  // A "tabela" do formato livre: dimensão Ação, métrica Eventos, tipo de célula
  // gráfico de barras. O padrão, porque ninguém nunca muda o padrão.
  const painel = el('div', {
    width: `${LARGURA_TABELA}px`, flex: 'none', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', fontSize: '12px', color: TEXTO,
  });
  const cabecalho = el('div', {
    display: 'flex', alignItems: 'flex-end', padding: '2px 0 6px', borderBottom: `1px solid ${LINHA}`, fontWeight: '500',
  });
  cabecalho.append(el('div', { flex: '1' }, 'Ação'), el('div', { width: '96px', textAlign: 'right', paddingRight: '4px' }, '↓ Eventos'));
  const tabela = el('div', { display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' });
  const notinha = el('div', { marginTop: 'auto', paddingTop: '8px', color: CINZA, lineHeight: '18px', whiteSpace: 'pre-line' });
  painel.append(cabecalho, tabela, notinha);
  corpo.append(palco, painel);

  const rodape = el('div', { padding: '0 16px 12px', fontSize: '12px', lineHeight: '18px', color: CINZA },
    'Clique no jogo · Enter começa · setas andam · Ctrl ou clique atira · Espaço ou botão direito abre porta · , e . de lado · Shift corre · 1-7 armas · Tab mapa · Esc menu · tecla do chefe: a da esquerda do 1');

  // a fofoca (snackbar, pros íntimos)
  const balao = el('div', {
    position: 'absolute', left: '16px', bottom: '16px', maxWidth: 'calc(100% - 32px)', boxSizing: 'border-box',
    padding: '12px 16px', borderRadius: '4px', background: '#323232', color: '#fff',
    fontSize: '14px', lineHeight: '20px', pointerEvents: 'none', opacity: '0', transform: 'translateY(8px)',
    transition: 'opacity .2s, transform .2s', boxShadow: '0 3px 5px -1px rgba(0,0,0,.2), 0 6px 10px 0 rgba(0,0,0,.14)',
  });

  // input escondido pro plano B (escolher o .wasm na mão)
  const seletor = el('input', { display: 'none' });
  seletor.type = 'file';
  seletor.accept = '.wasm,application/wasm';

  card.append(abas, corpo, rodape, balao, seletor);

  // arrastar pelas abas, igual janela do Windows 95. Mexeu menos de 4px, é clique.
  abas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    const r = card.getBoundingClientRect();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const mover = (ev) => {
      if (!arrastado && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 4) return;  // tremidinha não conta
      arrastado = true;
      card.style.left = `${Math.min(Math.max(r.left + ev.clientX - x0, 80 - r.width), window.innerWidth - 80)}px`;
      card.style.top = `${Math.min(Math.max(r.top + ev.clientY - y0, 0), window.innerHeight - 40)}px`;
    };
    const larga = () => {
      window.removeEventListener('mousemove', mover, true);
      window.removeEventListener('mouseup', larga, true);
    };
    window.addEventListener('mousemove', mover, true);
    window.addEventListener('mouseup', larga, true);
  });
  // duplo clique nas abas devolve o card pro lugar dele
  abas.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    arrastado = false;
    ajeitaOCard(true);
  });
  abaDeles.addEventListener('click', () => minimiza(true));
  abaNossa.addEventListener('click', () => { if (minimizado) minimiza(false); });
  abaMais.addEventListener('click', () => fofoca('Calma. Um DOOM de cada vez.'));

  tela.addEventListener('mousedown', (e) => {
    // o primeiro clique só pega o foco. Munição não dá em árvore.
    if (!inferno || document.activeElement !== tela) return;
    if (e.button === 0) {
      e.preventDefault();
      aperta(K.CTRL);
    } else if (e.button === 2) {
      e.preventDefault();
      aperta(K.ESPACO);
    }
  });
  tela.addEventListener('contextmenu', (e) => e.preventDefault());
  tela.addEventListener('focus', () => { jaFocou = true; atualizaPilula(); });
  tela.addEventListener('blur', () => { soltaTudo(); atualizaPilula(); });

  // plano B: a rede da firma bloqueou o CDN? arrasta o arquivo pra cá
  seletor.addEventListener('change', () => carregaArquivo(seletor.files && seletor.files[0]));
  card.addEventListener('dragover', (e) => e.preventDefault());
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    const arquivo = [...((e.dataTransfer && e.dataTransfer.files) || [])].find((f) => /\.wasm$/i.test(f.name));
    if (arquivo) carregaArquivo(arquivo);
    else avisa('Isso aí não é um .wasm. Bela tentativa.', 'Escolher doom.wasm', () => seletor.click());
  });

  /* ==========================================================================
   *  Bora
   * ======================================================================== */
  const api = {
    fechar,
    pausar() { pausado = true; soltaTudo(); atualizaPilula(); },
    continuar() { pausado = minimizado; atualizaPilula(); },
    reiniciar() { if (modulo) ligaOInferno(); },
    eventos: () => Object.fromEntries(eventos),   // "dá pra exportar pro Looker Studio?" Dá. Não vou.
  };
  window.doomGa4 = api;
  const montadoEm = Date.now();

  document.body.appendChild(card);
  avisa('Preparando o inferno...');
  ajeitaOCard(true);

  ouvir(window, 'keydown', naTecla, true);
  ouvir(window, 'keyup', naTecla, true);
  ouvir(window, 'mouseup', (e) => {
    if (e.button === 0) solta(K.CTRL);
    if (e.button === 2) solta(K.ESPACO);
  }, true);
  ouvir(window, 'blur', soltaTudo);                 // Alt+Tab com a seta apertada, um clássico
  ouvir(window, 'resize', () => ajeitaOCard(true));
  ouvir(window, 'hashchange', () => {               // o GA4 é SPA: trocou de tela, procura a exploração de novo
    pistas = [];
    ultimaProcura = 0;
    setTimeout(() => ajeitaOCard(true), 800);
  });
  ouvir(document, 'fullscreenchange', quandoATelaCheiaMuda);
  relogio = setInterval(aCadaSegundo, 1000);
  aCadaSegundo();

  if (!/(^|\.)analytics\.google\.com$/.test(location.hostname)) {
    log('Isso aqui nem é o GA4, mas tudo bem: DOOM roda em qualquer lugar.');
  }
  log('Bora. Baixando 6,8 MB de produtividade...');

  try {
    const bytes = await baixaOInferno();
    if (fechado) return;
    await carregaBytes(bytes);
  } catch (err) {
    if (!fechado) planoB(err);
  }

  /* ==========================================================================
   *  Daqui pra baixo é tudo function, na ordem que eu fui lembrando.
   *  O JavaScript iça tudo lá pra cima (hoisting), então relaxa.
   * ======================================================================== */

  // Liga (ou religa) o DOOM a partir do módulo já compilado
  async function ligaOInferno() {
    pararLoop();
    teclasApertadas.clear();
    inferno = null;
    try {
      const memoria = new WebAssembly.Memory({ initial: PAGINAS_MEMORIA });
      const instancia = await WebAssembly.instantiate(modulo, montaImports(memoria));
      if (fechado) return;
      inicio = performance.now();
      instancia.exports.main();   // inicializa WAD, zone memory, "refresh daemon"... os nomes de 1993 são ótimos
      inferno = instancia;
    } catch (err) {
      deuRuim(err);
      return;
    }
    confioNoRelogioDoDoom = typeof inferno.exports.I_GetTime === 'function';
    ultimoTic = -1;
    pausado = minimizado;
    desavisa();
    rafId = requestAnimationFrame(chamaODoom);
    fofoca('DOOM carregado. 6,8 MB de pura produtividade.');
    console.log('%cDOOM %cem formato livre', 'font:bold 20px monospace;color:#c62828', `font:bold 20px ${FONTE};color:${AZUL}`);
    log('Clique no jogo e aperte Enter. Pra fechar: doomGa4.fechar()');
  }

  function chamaODoom() {
    rafId = requestAnimationFrame(chamaODoom);
    if (!inferno || pausado) return;
    // Só chama o DOOM quando virou um tic novo (1/35 s). Se chamar antes, ele fica
    // num while esperando o tempo passar e a aba inteira trava junto, GA4 incluso.
    // Os 100 ms são seguro-morreu caso o relógio enlouqueça.
    // Obs: no começo de cada fase a tela "derrete" e a aba congela um segundinho.
    // É o efeito de 1993 rodando num while dentro do wasm; daqui de fora não tem como interromper.
    const agora = performance.now();
    const tic = ticAgora();
    if (tic === ultimoTic && agora - ultimoPasso < 100) return;
    ultimoTic = tic;
    ultimoPasso = agora;
    try {
      inferno.exports.doom_loop_step();
    } catch (err) {
      deuRuim(err);
    }
    // console.log('tic', tic)  // fica aí pra próxima vez que eu precisar sofrer
  }

  // Relógio em tics. Pergunto pro próprio DOOM; se ele responder besteira, uso o meu.
  function ticAgora() {
    if (confioNoRelogioDoDoom) {
      try {
        const t = inferno.exports.I_GetTime();
        if (Number.isFinite(t)) return t;
      } catch (e) { /* cai pro relógio JS */ }
      confioNoRelogioDoDoom = false;
    }
    return Math.floor((relogioDoJogo() * TICS_POR_SEGUNDO) / 1000);
  }

  function pararLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function deuRuim(err) {
    pararLoop();
    teclasApertadas.clear();
    inferno = null;
    const msg = String((err && err.message) || err);
    console.warn('%c[doom-ga4]', ESTILO_LOG, 'o DOOM parou:', err);
    if (err instanceof WebAssembly.LinkError) {
      // até é wasm, mas não é o DOOM que esse script conhece
      modulo = null;
      avisa(`Esse .wasm não é o DOOM que eu conheço:\n${msg}`, 'Escolher outro arquivo', () => seletor.click());
      return;
    }
    if (!modulo) {
      avisa(`Deu ruim antes do DOOM ligar:\n${msg}`);
      return;
    }
    // Sair pelo menu (Quit Game) termina num exit() que vira "unreachable" no wasm.
    // Não é bug, é o DOOM saindo de cena com estilo.
    const texto = /unreachable|exit/i.test(msg)
      ? 'O DOOM foi encerrado.\nTaxa de engajamento: 0%. A exploração continua aí, esperando você.'
      : `O DOOM caiu: ${msg}\nDiferente do GA4, pelo menos ele avisa quando quebra.`;
    avisa(texto, 'Voltar pro inferno', () => ligaOInferno());
  }

  function naTecla(e) {
    if (!inferno || pausado || document.activeElement !== tela) return;
    // F11, F12 e os atalhos do DevTools continuam do navegador
    if (e.code === 'F11' || e.code === 'F12' || (e.ctrlKey && e.shiftKey && /^Key[IJC]$/.test(e.code))) return;
    e.stopImmediatePropagation();      // o GA4 não precisa saber que você tá jogando
    if (e.code === 'Backquote') {
      // TECLA DO CHEFE. Esconde, pausa e devolve o teclado pro GA4. Cara de paisagem.
      e.preventDefault();
      if (e.type === 'keydown') {
        minimiza(true);
        tela.blur();
      }
      return;
    }
    const codigo = teclaProDoom(e);
    if (!codigo) {
      // tecla que o DOOM não conhece. Pro GA4 isso é (not set), óbvio.
      if (e.type === 'keydown' && !e.repeat) contaEvento('(not set)');
      return;
    }
    e.preventDefault();                // seta não rola a página, Tab não foge, F5 não recarrega...
    if (e.type === 'keydown') aperta(codigo);
    else solta(codigo);
  }

  function aperta(codigo) {
    if (!inferno || teclasApertadas.has(codigo)) return;   // auto-repeat do teclado o DOOM dispensa
    teclasApertadas.add(codigo);
    inferno.exports.add_browser_event(0, codigo);
    contaEvento(qualAcao(codigo));
    if (codigo >= 97 && codigo <= 122) pegaCheat(String.fromCharCode(codigo));
  }

  function solta(codigo) {
    if (!inferno || !teclasApertadas.has(codigo)) return;
    teclasApertadas.delete(codigo);
    inferno.exports.add_browser_event(1, codigo);
  }

  // Solta tudo quando o foco sai. Senão o marine fica andando sozinho pra sempre,
  // tipo eu indo na cozinha "só pegar um café".
  function soltaTudo() {
    for (const codigo of [...teclasApertadas]) solta(codigo);
  }

  function qualAcao(codigo) {
    if (ACAO_DA_TECLA.has(codigo)) return ACAO_DA_TECLA.get(codigo);
    if (codigo >= 49 && codigo <= 55) return 'Trocar de arma';
    if (codigo >= K.F1 && codigo <= K.F1 + 9) return 'Apertar F-alguma-coisa';
    return '(other)';   // letras e afins. Alta cardinalidade, o GA4 entenderia.
  }

  function pegaCheat(letra) {
    digitado = (digitado + letra).slice(-12);
    for (const [cheat, fofocaDoCheat] of Object.entries(CHEATS)) {
      if (!digitado.endsWith(cheat)) continue;
      digitado = '';
      contaEvento('Trapacear');
      fofoca(fofocaDoCheat, 6000);
      log(fofocaDoCheat);
      return;
    }
  }

  function contaEvento(acao) {
    eventos.set(acao, (eventos.get(acao) || 0) + 1);
  }

  function aCadaSegundo() {
    fps = quadros;
    quadros = 0;
    desenhaTabela();
    if (!arrastado) ajeitaOCard();
  }

  function desenhaTabela() {
    const seg = inferno ? Math.floor((performance.now() - inicio) / 1000) : 0;
    const tempo = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
    notinha.textContent = `${fps} fps · ${tempo} no inferno\nTaxa de rejeição dos demônios: 100%`;
    if (!painel.clientHeight) return;   // painel escondido (tela pequena ou minimizado)

    const linhas = [...eventos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
    const total = linhas.reduce((soma, [, n]) => soma + n, 0);
    const maior = linhas.length ? linhas[0][1] : 0;
    const cabem = Math.max(1, Math.floor((painel.clientHeight - cabecalho.offsetHeight - notinha.offsetHeight - 56) / 28));
    const filhos = [linhaDeTotais(total)];
    if (!linhas.length) {
      // a mensagem oficial do GA4, com um empurrãozinho
      filhos.push(el('div', { padding: '16px 0', color: CINZA, lineHeight: '18px' },
        'Nenhum dado para esta combinação de valores. Experimenta apertar alguma tecla.'));
    }
    linhas.slice(0, cabem).forEach(([acao, n], i) => filhos.push(linhaDaTabela(i + 1, acao, n, maior)));
    tabela.replaceChildren(...filhos);
  }

  function linhaDeTotais(total) {
    const linha = el('div', { display: 'flex', alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${LINHA}`, fontWeight: '500' });
    const valor = el('div', { width: '96px', textAlign: 'right', paddingRight: '4px' });
    valor.append(el('div', null, numero(total)), el('div', { fontSize: '11px', color: CINZA, fontWeight: '400' }, '100% do total'));
    linha.append(el('div', { flex: '1' }, 'Totais'), valor);
    return linha;
  }

  function linhaDaTabela(posicao, acao, n, maior) {
    const linha = el('div', { display: 'flex', alignItems: 'center', height: '28px', flex: 'none', borderBottom: '1px solid #f1f3f4' });
    const celula = el('div', { position: 'relative', width: '96px', height: '20px', flex: 'none' });
    celula.append(
      // tipo de célula "gráfico de barras". Não me pergunte por que 2px, ficou bonito.
      el('div', {
        position: 'absolute', left: '0', top: '2px', bottom: '2px', borderRadius: '2px',
        width: `${maior ? Math.max(3, (n / maior) * 100) : 0}%`, background: 'rgba(26,115,232,.2)',
      }),
      el('div', { position: 'relative', textAlign: 'right', lineHeight: '20px', paddingRight: '4px' }, numero(n)),
    );
    linha.append(
      el('div', { width: '20px', flex: 'none', color: CINZA }, String(posicao)),
      el('div', { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, acao),
      celula,
    );
    return linha;
  }

  // Calcula onde e de que tamanho o card fica. O jogo é sempre 4:3: o DOOM foi feito
  // pra monitor de tubo com pixel esticado, então o 640x400 aparece como 640x480. Raiz.
  function ajeitaOCard(forcar) {
    if (fechado) return;
    if (document.fullscreenElement === palco) {
      const h = Math.floor(Math.min(window.innerHeight, (window.innerWidth * 3) / 4));
      tela.style.height = `${h}px`;
      tela.style.width = `${Math.floor((h * 4) / 3)}px`;
      return;
    }
    if (minimizado) {
      encostaNoCanto();
      return;
    }
    const area = ondeCabe();
    avisaSeAchouAExploracao(area.exploracao);
    const chave = [area.left, area.top, area.width, area.height].join();
    if (!forcar && chave === ultimaArea) return;   // nada mudou, nada a fazer
    ultimaArea = chave;
    // console.log('area', area)  // deixei comentado pra próxima vez que o GA4 mudar o layout

    const sobraW = area.width - 24;
    const sobraH = area.height - 24;
    // Duas passadas de propósito: o rodapé quebra linha diferente quando o card muda
    // de largura, aí a altura que sobra pro jogo muda junto.
    for (let passada = 0; passada < 2; passada++) {
      const extraH = abas.offsetHeight + rodape.offsetHeight + 20;
      let comTabela = true;
      let h = Math.min(600, sobraH - extraH, ((sobraW - 48 - LARGURA_TABELA) * 3) / 4);
      if (h < 240) {
        comTabela = false;   // tela pequena: a tabela some, o jogo tem prioridade. Óbvio.
        h = Math.min(600, sobraH - extraH, ((sobraW - 32) * 3) / 4);
      }
      h = Math.max(180, Math.floor(h));
      const w = Math.round((h * 4) / 3);
      tela.style.width = `${w}px`;
      tela.style.height = `${h}px`;
      painel.style.display = comTabela ? 'flex' : 'none';
      painel.style.height = `${h}px`;
      // 48 = paddings (32) + o espaço entre o jogo e a tabela (16)
      card.style.width = `${w + (comTabela ? 48 + LARGURA_TABELA : 32)}px`;
    }
    if (!arrastado) {
      card.style.left = `${Math.round(area.left + Math.max(12, (area.width - card.offsetWidth) / 2))}px`;
      card.style.top = `${Math.round(area.top + Math.max(12, (area.height - card.offsetHeight) / 2))}px`;
    }
  }

  function avisaSeAchouAExploracao(achou) {
    if (achou === achouExploracao) return;
    if (!achou && Date.now() - montadoEm < 3000) return;   // dá um tempinho pro GA4 terminar de carregar
    achouExploracao = achou;
    if (achou) {
      fofoca('Achei a exploração. Com licença, vou ocupar essa tabela aqui.');
    } else {
      fofoca('Isso aqui não parece uma exploração em formato livre. Abre Explorar › Formato livre que eu me mudo pra lá sozinho.', 9000);
    }
  }

  function ondeCabe() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const exploracao = areaDaExploracao(vw, vh);
    if (exploracao) return exploracao;
    // Não achei a exploração: tenta a maior tabela da tela, depois o <main>, e em
    // último caso fica no meio da tela mesmo, com cara de quem não quer nada.
    const alvo = maiorTabela() || document.querySelector('main, [role="main"]');
    if (alvo) {
      const r = alvo.getBoundingClientRect();
      if (r.width > 400) {
        const left = Math.max(0, Math.round(r.left));
        const top = Math.round(Math.min(Math.max(0, r.top), vh - 300));
        return { left, top, width: vw - left - 16, height: vh - top, exploracao: false };
      }
    }
    return { left: 0, top: 0, width: vw, height: vh, exploracao: false };
  }

  // A área da tabela fica à direita dos painéis Variáveis e Configurações, e
  // começa onde está a aba "Formato livre 1". Então: acha os painéis, vê onde
  // eles terminam, e o resto da tela é nosso.
  function areaDaExploracao(vw, vh) {
    let area = calculaArea(vw, vh);
    // não achou com as pistas que eu tinha? varre o DOM de novo, mas no máximo a
    // cada 2 s, que o DOM do GA4 não é pequeno e eu não sou o Chrome
    if (!area && Date.now() - ultimaProcura > 2000) {
      ultimaProcura = Date.now();
      pistas = procuraPistas();
      area = calculaArea(vw, vh);
    }
    return area;
  }

  function calculaArea(vw, vh) {
    let esquerda = 0;
    let topo = vh;
    for (const p of pistas) {
      const r = p.el.getBoundingClientRect();
      if (!r.width || !r.height) continue;   // painel recolhido ou escondido
      if (p.aba) {
        esquerda = Math.max(esquerda, r.left - 24);
        topo = Math.min(topo, r.top - 8);
      } else {
        const rp = sobeAteOPainel(p.el, vh).getBoundingClientRect();
        if (rp.width < 520) esquerda = Math.max(esquerda, rp.right);
        topo = Math.min(topo, rp.top);
      }
    }
    if (!esquerda || vw - esquerda < 420) return null;
    topo = Math.max(56, Math.min(topo, vh - 320));
    return {
      left: Math.round(esquerda + 8), top: Math.round(topo),
      width: Math.round(vw - esquerda - 24), height: Math.round(vh - topo - 8), exploracao: true,
    };
  }

  function procuraPistas() {
    const achados = [];
    const andarilho = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let no = andarilho.nextNode(); no; no = andarilho.nextNode()) {
      const texto = no.nodeValue.trim();
      if (texto.length < 8 || texto.length > 30) continue;
      const aba = NOME_DE_ABA.test(texto);
      if (!aba && !TITULO_DE_PAINEL.test(texto)) continue;
      const dono = no.parentElement;
      if (dono && !card.contains(dono)) achados.push({ el: dono, aba });   // a nossa aba falsa não vale
    }
    return achados;
  }

  // sobe do título até achar o painel inteiro (alto e estreito)
  function sobeAteOPainel(elemento, vh) {
    let atual = elemento;
    while (atual.parentElement && atual.parentElement !== document.body && atual.getBoundingClientRect().height < vh * 0.5) {
      atual = atual.parentElement;
    }
    return atual;
  }

  function maiorTabela() {
    let melhor = null;
    let maiorArea = 0;
    for (const t of document.querySelectorAll('table, [role="grid"], [role="table"], [role="treegrid"]')) {
      if (card.contains(t)) continue;
      const r = t.getBoundingClientRect();
      if (r.width > 300 && r.height > 100 && r.width * r.height > maiorArea) {
        melhor = t;
        maiorArea = r.width * r.height;
      }
    }
    return melhor;
  }

  // minimizado vira uma abinha lá no canto, longe da tabela de verdade
  function encostaNoCanto() {
    card.style.width = 'auto';
    if (arrastado) return;
    card.style.left = `${Math.max(8, window.innerWidth - card.offsetWidth - 24)}px`;
    card.style.top = `${Math.max(8, window.innerHeight - card.offsetHeight - 24)}px`;
  }

  async function baixaOInferno() {
    let ultimoErro = null;
    for (const url of ESPELHOS) {
      try {
        // credentials: 'omit' porque o CDN não precisa dos cookies do Google de ninguém
        const resp = await fetch(url, { mode: 'cors', credentials: 'omit', signal: abortador.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const total = Number(resp.headers.get('content-length')) || 0;
        if (!resp.body || !resp.body.getReader) return await resp.arrayBuffer();

        const leitor = resp.body.getReader();
        const pedacos = [];
        let recebido = 0;
        for (;;) {
          const { done, value } = await leitor.read();
          if (done) break;
          pedacos.push(value);
          recebido += value.length;
          mostraProgresso(recebido, total);
        }
        const bytes = new Uint8Array(recebido);
        let pos = 0;
        for (const p of pedacos) {
          bytes.set(p, pos);
          pos += p.length;
        }
        return bytes.buffer;
      } catch (err) {
        if (fechado) throw err;
        console.warn('%c[doom-ga4]', ESTILO_LOG, `não rolou baixar de ${url}:`, err);
        ultimoErro = err;
      }
    }
    throw ultimoErro || new Error('acabaram os espelhos');
  }

  function mostraProgresso(recebido, total) {
    const mb = (bytes) => (bytes / 1048576).toFixed(1).replace('.', ',');
    // se veio comprimido o content-length mente, aí só mostro os MB mesmo
    if (!total || recebido > total) {
      avisa(`Baixando o inferno... ${mb(recebido)} MB`);
      return;
    }
    const pct = Math.floor((recebido / total) * 100);
    avisa(`${FRASES_DE_CARREGAMENTO[Math.min(3, Math.floor(pct / 25))]} ${pct}%\n${mb(recebido)} de ${mb(total)} MB`);
  }

  // As funções que o doom.wasm espera receber do JavaScript
  function montaImports(memoria) {
    const decodificador = new TextDecoder('utf-8');
    const lerTexto = (ptr, len) => decodificador.decode(new Uint8Array(memoria.buffer, ptr, len));

    // Cota de linhas no console. Se o DOOM resolver ficar tagarela, o DevTools não morre junto.
    let cota = 300;
    const falar = (tipo, texto) => {
      if (cota <= 0) return;
      if (--cota === 0) {
        console.debug('%c[DOOM]', ESTILO_LOG, '...e o resto eu calei. Ninguém lê log mesmo.');
        return;
      }
      console[tipo]('%c[DOOM]', ESTILO_LOG, texto);
    };

    // O DOOM escreve no stdout aos pedacinhos (o R_Init imprime um ponto por vez,
    // a barra de progresso de 1993), então junto até fechar a linha.
    const sobra = { log: '', warn: '' };
    const saida = (tipo) => (ptr, len) => {
      sobra[tipo] += lerTexto(ptr, len);
      let i;
      while ((i = sobra[tipo].indexOf('\n')) !== -1) {
        const linha = sobra[tipo].slice(0, i).trimEnd();
        sobra[tipo] = sobra[tipo].slice(i + 1);
        if (linha) falar(tipo, linha);
      }
    };

    return {
      js: {
        js_milliseconds_since_start: relogioDoJogo,
        js_console_log: (ptr, len) => falar('debug', lerTexto(ptr, len)),
        js_stdout: saida('log'),
        js_stderr: saida('warn'),
        js_draw_screen: (ptr) => {
          // view nova a cada frame: se a memória do wasm crescer, o buffer antigo vira pó
          const pixels = new Uint8ClampedArray(memoria.buffer, ptr, LARGURA * ALTURA * 4);
          ctx.putImageData(new ImageData(pixels, LARGURA, ALTURA), 0, 0);
          quadros++;
        },
      },
      env: { memory: memoria },
    };
  }

  async function carregaBytes(bytes) {
    avisa('Compilando o inferno... (sem amostragem)');
    await esperar(30);   // deixa o navegador pintar o aviso antes de compilar
    try {
      modulo = await WebAssembly.compile(bytes);
    } catch (err) {
      console.error('%c[doom-ga4]', ESTILO_LOG, err);
      if (/unsafe-eval|wasm-unsafe-eval|Content Security Policy/i.test(String(err && err.message))) {
        avisa('O GA4 apertou o CSP e bloqueou WebAssembly nesta página.\nAí não tem jeitinho brasileiro que resolva, desculpa.');
      } else {
        avisa(`Esse arquivo não parece ser o doom.wasm certo.\n(${err.message})`, 'Escolher outro arquivo', () => seletor.click());
      }
      return;
    }
    if (!fechado) await ligaOInferno();
  }

  function planoB(err) {
    avisa(
      `Não consegui baixar o DOOM (${(err && err.message) || err}).\n` +
      `Baixe o doom.wasm em:\n${ESPELHOS[1]}\n` +
      'e arraste o arquivo pra cá, ou escolha ele no computador.',
      'Escolher doom.wasm',
      () => seletor.click(),
    );
  }

  async function carregaArquivo(arquivo) {
    if (!arquivo) return;
    try {
      await carregaBytes(await arquivo.arrayBuffer());
    } catch (err) {
      deuRuim(err);
    }
  }

  async function telaCheia() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await palco.requestFullscreen();
      tela.focus();
      // Em tela cheia o Esc é do navegador e o menu do DOOM nunca abriria. O Keyboard
      // Lock do Chrome resolve: Esc vai pro jogo, e segurar o Esc sai da tela cheia.
      if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {});
    } catch (err) {
      log('Tela cheia não rolou:', err.message);
    }
  }

  function quandoATelaCheiaMuda() {
    if (!document.fullscreenElement && navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
    ajeitaOCard(true);
    if (document.fullscreenElement === palco) tela.focus();
  }

  // Esconde e pausa. Clicar na aba "Formato livre 1" faz a mesma coisa, pra quando
  // alguém passar atrás de você na hora errada.
  function minimiza(quer) {
    minimizado = typeof quer === 'boolean' ? quer : !minimizado;
    pausado = minimizado;
    if (minimizado) {
      soltaTudo();
      calaAFofoca();   // senão o balão fica vazando pra fora da abinha e entrega tudo
    }
    corpo.style.display = minimizado ? 'none' : 'flex';
    botaoTelaCheia.style.display = minimizado ? 'none' : '';
    rodape.style.display = minimizado ? 'none' : '';
    abaDeles.style.display = minimizado ? 'none' : 'flex';
    abaMais.style.display = minimizado ? 'none' : 'flex';
    selo.style.display = minimizado ? 'none' : 'flex';
    abaNossa.textContent = minimizado ? 'DOOM 1 (pausado)' : 'DOOM 1';
    botaoMinimizar.textContent = minimizado ? '+' : '–';
    botaoMinimizar.title = minimizado ? 'Voltar pro inferno' : 'Esconder e pausar';
    if (!minimizado) arrastado = false;
    ajeitaOCard(true);
    atualizaPilula();
  }

  function fechar() {
    if (fechado) return;
    fechado = true;
    abortador.abort();
    try { soltaTudo(); } catch (e) { /* a essa altura, tanto faz */ }
    pararLoop();
    clearInterval(relogio);
    clearTimeout(timerFofoca);
    if (document.fullscreenElement === palco) document.exitFullscreen().catch(() => {});
    desfazer.forEach((fn) => fn());
    card.remove();
    inferno = null;
    modulo = null;   // devolve os ~7 MB. A gente não é o Chrome.
    if (window.doomGa4 === api) delete window.doomGa4;
    log('Fechado. Pode voltar pra exploração, ninguém viu nada.');
  }

  function aba(texto, ativa, dica) {
    const a = el('div', {
      display: 'flex', alignItems: 'center', padding: '0 16px', flex: '0 1 auto', minWidth: '0',
      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer', boxSizing: 'border-box',
      fontSize: '14px', fontWeight: ativa ? '500' : '400', color: ativa ? AZUL : CINZA,
      borderBottom: `3px solid ${ativa ? AZUL : 'transparent'}`,
    }, texto);
    a.title = dica;
    return a;
  }

  function botao(texto, dica, acao) {
    const b = el('button', {
      width: '32px', height: '32px', padding: '0', border: 'none', borderRadius: '50%', alignSelf: 'center',
      background: 'transparent', color: CINZA, fontSize: '18px', lineHeight: '32px',
      fontFamily: FONTE, cursor: 'pointer', flex: 'none',
    }, texto);
    b.type = 'button';
    b.title = dica;
    b.addEventListener('mouseenter', () => { b.style.background = '#f1f3f4'; });
    b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
    b.addEventListener('click', acao);
    return b;
  }

  function avisa(texto, textoBotao, acao) {
    avisoTexto.textContent = texto;
    avisoBotao.style.display = textoBotao ? 'inline-block' : 'none';
    avisoBotao.textContent = textoBotao || '';
    avisoBotao.onclick = acao || null;
    aviso.style.display = 'flex';
    atualizaPilula();
  }

  function desavisa() {
    aviso.style.display = 'none';
    atualizaPilula();
  }

  function atualizaPilula() {
    const mostrar = inferno && !pausado && aviso.style.display === 'none' && document.activeElement !== tela;
    pilula.textContent = jaFocou ? 'Clique pra voltar pro inferno' : 'Clique aqui e aperte Enter pra jogar';
    pilula.style.display = mostrar ? 'block' : 'none';
  }

  function fofoca(texto, ms = 4500) {
    if (minimizado) return;   // escondido não fofoca, senão o disfarce vai pro saco
    balao.textContent = texto;
    balao.style.opacity = '1';
    balao.style.transform = 'translateY(0)';
    clearTimeout(timerFofoca);
    timerFofoca = setTimeout(calaAFofoca, ms);
  }

  function calaAFofoca() {
    clearTimeout(timerFofoca);
    balao.style.opacity = '0';
    balao.style.transform = 'translateY(8px)';
  }

  // O switch gigante ficou aqui no final pra não assustar quem abre o arquivo.
  // e.code (posição física) pra quase tudo, e e.key pras letras, senão o IDDQD
  // não funciona em teclado que não é QWERTY. Temos prioridades.
  function teclaProDoom(e) {
    switch (e.code) {
      case 'ArrowRight': return K.DIREITA;
      case 'ArrowLeft': return K.ESQUERDA;
      case 'ArrowUp': return K.CIMA;
      case 'ArrowDown': return K.BAIXO;
      case 'Escape': return K.ESC;
      case 'Enter': case 'NumpadEnter': return K.ENTER;
      case 'Tab': return K.TAB;
      case 'Backspace': return K.BACKSPACE;
      case 'Space': return K.ESPACO;
      case 'Pause': return K.PAUSE;
      case 'ShiftLeft': case 'ShiftRight': return K.SHIFT;
      case 'ControlLeft': case 'ControlRight': return K.CTRL;
      case 'AltLeft': case 'AltRight': return K.ALT;
      case 'Comma': return 44;                         // , anda de lado pra esquerda
      case 'Period': return 46;                        // . anda de lado pra direita
      case 'Minus': case 'NumpadSubtract': return 45;  // - diminui a tela / afasta o mapa
      case 'Equal': case 'NumpadAdd': return 61;       // = aumenta
      default: break;
    }
    // F1 a F10. F11 e F12 ficam com o navegador, senão você não abre nem o DevTools pra me xingar
    const f = /^F(\d{1,2})$/.exec(e.code);
    if (f) return +f[1] <= 10 ? K.F1 + (+f[1] - 1) : 0;
    // números pela posição: correndo (Shift) e apertando 3, continua sendo 3 e não #
    const n = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (n) return 48 + +n[1];
    // letras sempre minúsculas, que é como o DOOM espera
    if (e.key && e.key.length === 1) {
      const c = e.key.toLowerCase().charCodeAt(0);
      if (c >= 97 && c <= 122) return c;
    }
    if (/^Key[A-Z]$/.test(e.code)) return e.code.toLowerCase().charCodeAt(3);
    return 0;
    // TODO: som. Talvez em 2027. Talvez nunca. Provavelmente nunca.
  }
})();
