const urlParams = new URLSearchParams(window.location.search);
const numeroMesa = urlParams.get('mesa') || '1';
document.getElementById("titulo-comanda").textContent = `Comanda da Mesa ${numeroMesa}`;

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

// Criação dos cards com botão '?'
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

function adicionarItem(nome, preco, botao) {
  pedido.push({ nome, preco });
  total += preco;

  const li = document.createElement("li");
  li.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
  pedidoUl.appendChild(li);

  // Flash no item da lista
  li.classList.add('flash');
  setTimeout(() => li.classList.remove('flash'), 800);

  totalSpan.textContent = total.toFixed(2);

  // Atualiza título com quantidade
  const tituloPedido = document.querySelector('h2');
  tituloPedido.textContent = `Sua Comanda (${pedido.length} item${pedido.length > 1 ? 's' : ''})`;

  // Botão "Finalizar Pedido" pulsa
  const botaoFinalizar = document.querySelector('button');
  if (pedido.length > 0) {
    botaoFinalizar.classList.add('pulse');
  } else {
    botaoFinalizar.classList.remove('pulse');
  }

  // Efeito no botão "Adicionar"
  botao.classList.add('clicked');
  setTimeout(() => {
    botao.classList.remove('clicked');
  }, 300);

  // Mensagem flutuante
  mostrarMensagemAdicao(nome);
}

function mostrarMensagemAdicao(texto) {
  const mensagemDiv = document.getElementById("mensagem-adicao");
  mensagemDiv.textContent = `✅ ${texto} adicionado à comanda!`;
  mensagemDiv.style.display = "block";

  setTimeout(() => {
    mensagemDiv.style.display = "none";
  }, 2000);
}

function fazerPedido() {
  const dadosPedido = {
    mesa: numeroMesa,
    itens: pedido,
    total: total,
    status: "aguardando"
  };

  fetch('http://localhost:3000/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dadosPedido)
  })
  .then(response => response.json())
  .then(() => {
    return fetch('http://localhost:3000/pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosPedido)
    });
  })
  .then(response => response.json())
  .then(dados => {
    if (dados.url) {
      window.location.href = dados.url;
    } else {
      alert("Erro ao iniciar o pagamento.");
    }
  })
  .catch(error => {
    console.error("Erro:", error);
    alert("Erro ao processar pedido ou pagamento.");
  });
}


function resetarComanda() {
  pedido = [];
  total = 0;
  pedidoUl.innerHTML = "";
  totalSpan.textContent = "0.00";

  const tituloPedido = document.querySelector('h2');
  tituloPedido.textContent = "Sua Comanda";

  const botaoFinalizar = document.querySelector('button');
  botaoFinalizar.classList.remove('pulse');
}

// Função para mostrar descrição do prato
function mostrarDescricao(nome, descricao) {
  const popupExistente = document.querySelector(".popup-descricao");
  if (popupExistente) popupExistente.remove();

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
