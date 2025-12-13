// ===========================
//   COMANDA DO CLIENTE
// ===========================

// Pega número da mesa pela URL
const urlParams = new URLSearchParams(window.location.search);
const numeroMesa = urlParams.get("mesa") || "1";

document.getElementById("titulo-comanda").textContent =
  `Comanda da Mesa ${numeroMesa}`;

// Itens do cardápio
const menuItems = [
  { nome: "Hamburguer", preco: 25.00, imagem: "imagens/hambúrguer.png", descricao: "Pão artesanal, carne 180g, queijo e salada." },
  { nome: "Pizza", preco: 35.00, imagem: "imagens/pizza.png", descricao: "Pizza média, 8 fatias, sabores variados." },
  { nome: "Refrigerante", preco: 6.00, imagem: "imagens/refrigerante.png", descricao: "Lata 350ml de refrigerante gelado." },
  { nome: "Massa Alho e Óleo", preco: 22.00, imagem: "imagens/massa.png", descricao: "Espaguete ao alho e óleo com toque de pimenta." },
  { nome: "Batata Frita", preco: 15.00, imagem: "imagens/batata.png", descricao: "Porção média de batatas fritas crocantes." },
  { nome: "À la Minuta", preco: 28.00, imagem: "imagens/minuta.png", descricao: "Prato com arroz, feijão, bife, ovo e salada." }
];

let pedido = [];
let total = 0;

const menuDiv = document.getElementById("menu");
const pedidoUl = document.getElementById("pedido");
const totalSpan = document.getElementById("total");

// --- Renderiza o cardápio ---
menuItems.forEach(item => {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <img src="${item.imagem}" alt="${item.nome}">
    <h3>${item.nome}</h3>
    <p>R$ ${item.preco.toFixed(2)}</p>
    <button class="add-btn" onclick="adicionarItem('${item.nome}', ${item.preco}, this)">Adicionar</button>
  `;

  menuDiv.appendChild(card);
});

// --- Adiciona item ---
function adicionarItem(nome, preco, botao) {
  pedido.push({ nome, preco });
  total += preco;

  const li = document.createElement("li");
  li.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
  pedidoUl.appendChild(li);

  li.classList.add("flash");
  setTimeout(() => li.classList.remove("flash"), 800);

  totalSpan.textContent = total.toFixed(2);

  const tituloPedido = document.querySelector("h2");
  tituloPedido.textContent =
    `Sua Comanda (${pedido.length} item${pedido.length > 1 ? "s" : ""})`;

  const botaoFinalizar = document.querySelector("button");
  if (pedido.length > 0) botaoFinalizar.classList.add("pulse");
  else botaoFinalizar.classList.remove("pulse");

  botao.classList.add("clicked");
  setTimeout(() => botao.classList.remove("clicked"), 300);

  mostrarMensagemAdicao(nome);
}

function mostrarMensagemAdicao(texto) {
  const div = document.getElementById("mensagem-adicao");
  div.textContent = `✅ ${texto} adicionado à comanda!`;
  div.style.display = "block";
  setTimeout(() => (div.style.display = "none"), 2000);
}

// ===========================
//   FINALIZAR PEDIDO + PIX
// ===========================

async function fazerPedido() {
  if (pedido.length === 0) {
    alert("Adicione itens ao pedido antes de finalizar.");
    return;
  }

  const dadosPedido = {
    mesa: numeroMesa,
    itens: pedido,
    total: total,
    status: "aguardando",
  };

  try {
    // 1 — Salva pedido no backend
    const resposta = await fetch("http://localhost:3000/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dadosPedido),
    });

    const pedidoCriado = await resposta.json();

    // 2 — Inicia PIX chamando o backend 
    const respostaPix = await fetch("http://localhost:3000/create_pix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total: pedidoCriado.total }) 
    });

    const dados = await respostaPix.json();

    if (!dados.qr_code_base64 || !dados.qr_code) {
      alert("Erro ao gerar QR Code PIX.");
      console.error(dados);
      return;
    }

    abrirModalPix(dados.qr_code_base64, dados.qr_code);

  } catch (error) {
    console.error("Erro ao processar pedido:", error);
    alert("Erro ao processar pedido.");
  }
}

// ==== MODAL PIX ====

function abrirModalPix(imgBase64, copiaCola) {
  const modal = document.createElement("div");
  modal.classList = "modal-pix";

  modal.innerHTML = `
    <div class="pix-box">
      <h2>Pagar com PIX</h2>

      <img src="data:image/png;base64,${imgBase64}" class="qr-pix">

      <p>Copia e cola:</p>
      <textarea class="copia-cola">${copiaCola}</textarea>

      <button onclick="navigator.clipboard.writeText('${copiaCola}')">
        Copiar PIX
      </button>

      <button class="fechar" onclick="this.parentElement.parentElement.remove()">
        Fechar
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

function resetarComanda() {
  pedido = [];
  total = 0;
  pedidoUl.innerHTML = "";
  totalSpan.textContent = "0.00";

  const tituloPedido = document.querySelector("h2");
  tituloPedido.textContent = "Sua Comanda";

  const botaoFinalizar = document.querySelector("button");
  botaoFinalizar.classList.remove("pulse");
}

// ===========================
//   DESCRIÇÃO DOS PRATOS
// ===========================

function mostrarDescricao(nome, descricao) {
  const existente = document.querySelector(".popup-descricao");
  if (existente) existente.remove();

  const popup = document.createElement("div");
  popup.className = "popup-descricao";

  popup.innerHTML = `
    <div class="conteudo-popup">
      <button class="fechar-popup" onclick="this.parentElement.parentElement.remove()">X</button>
      <h2>${nome}</h2>
      <p>${descricao}</p>
    </div>
  `;

  document.body.appendChild(popup);
}

// ===========================
//   PAINEL ADMIN (MESAS)
// ===========================

const API_URL = "http://localhost:3000";

setInterval(carregarMesas, 5000);
window.onload = carregarMesas;

async function carregarMesas() {
  try {
    const resposta = await fetch(`${API_URL}/pedidos`);
    const dados = await resposta.json();

    const container = document.getElementById("mesas-container");
    container.innerHTML = "";

    dados.mesas?.forEach(mesa => {
      const div = document.createElement("div");
      div.classList.add("mesa");

      const fecharMesaBtn = mesa.status !== 'livre' ? 
        `<button class="finalizar finalizar-mesa" onclick="finalizarMesa(${mesa.mesa})">Fechar Conta / Liberar</button>` : '';

      div.innerHTML = `
        <h2>Mesa ${mesa.mesa}</h2>
        <span class="status ${mesa.status}">${mesa.status.toUpperCase()}</span>
        <br>
        <button class="finalizar" onclick="abrirComanda(${mesa.mesa})">
          Gerenciar Pedido
        </button>
        ${fecharMesaBtn} 
      `;

      container.appendChild(div);
    });
  } catch (erro) {
    console.error("Erro ao carregar mesas:", erro);
  }
}

async function finalizarMesa(mesa) {
  if (!confirm(`Confirma o fechamento da conta e a liberação da Mesa ${mesa}?`)) return;

  try {
    const resposta = await fetch(`${API_URL}/pedidos/fechar/${mesa}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!resposta.ok) throw new Error("Falha ao fechar a mesa.");
    
    carregarMesas(); 
  } catch (erro) {
    console.error("Erro ao fechar conta:", erro);
  }
}

async function abrirComanda(numeroMesa) {
  const confirmar = confirm(`Abrir comanda para a Mesa ${numeroMesa}?`);
  if (!confirmar) return;

  const itens = [
    { nome: "Prato Executivo", preco: 25.0 },
    { nome: "Refrigerante", preco: 6.0 },
  ];

  const pedido = {
    mesa: numeroMesa.toString(),
    itens,
    status: "pendente",
  };

  try {
    const resposta = await fetch(`${API_URL}/pedidos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
    });

    const pedidoCriado = await resposta.json();

    // PIX GERADO 
    const respostaPix = await fetch(`${API_URL}/create_pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total: pedidoCriado.total }) 
    });

    const dados = await respostaPix.json();

    abrirModalPix(dados.qr_code_base64, dados.qr_code);

  } catch (erro) {
    console.error("Erro ao abrir comanda:", erro);
  }
}

