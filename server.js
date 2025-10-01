const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();

app.use(express.static(__dirname));
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'db.json');
const ACCESS_TOKEN = 'TEST-6035047548343306-062222-92c47ab4de3216b61ea3dd308b6c8d93-2019074163';

let pedidos = [];

// Carrega pedidos do arquivo JSON
function carregarPedidos() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const json = JSON.parse(data);
    pedidos = json.pedidos || [];
  } catch (err) {
    pedidos = [];
  }
}

// Salva pedidos no arquivo JSON
function salvarPedidos() {
  const json = JSON.stringify({ pedidos }, null, 2);
  fs.writeFileSync(DB_PATH, json, 'utf-8');
}

// Inicializa os pedidos ao iniciar o servidor
carregarPedidos();

// Retorna pedidos e status das mesas
app.get('/pedidos', (req, res) => {
  const mesasStatus = [1, 2, 3, 4, 5].map(num => {
    const pedidoMesa = pedidos.find(p => p.mesa === String(num));

    let status = 'livre';
    if (pedidoMesa?.status === 'comendo') {
      status = 'comendo';
    } else if (pedidoMesa?.status === 'aguardando' || pedidoMesa?.status === 'pendente') {
      status = 'aguardando';
    }

    return {
      mesa: String(num),
      status
    };
  });

  res.json({
    mesas: mesasStatus,
    pedidos: pedidos
  });
});


// Cria um novo pedido e atualiza vendas
app.post('/pedidos', (req, res) => {
  const novoPedido = { id: gerarId(), ...req.body };
  pedidos.push(novoPedido);

  try {
    // Lê o banco
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const json = JSON.parse(data);

    // Garante que exista a chave vendas
    if (!json.vendas) {
      json.vendas = [];
    }

    // Atualiza vendas de acordo com itens do pedido
    novoPedido.itens.forEach(item => {
      // Procura prato existente
      let prato = json.vendas.find(v => v.nome === item.nome);

      // Se não existir, cria registro novo
      if (!prato) {
        prato = {
          nome: item.nome,
          custo: item.preco * 0.5, // estimativa simples (50% do preço)
          quantidade: 0,
          receita: 0
        };
        json.vendas.push(prato);
        console.log(`🍽️ Novo prato adicionado ao controle: ${item.nome}`);
      }

      // Atualiza estatísticas
      prato.quantidade += 1;
      prato.receita += item.preco;

      console.log(`📊 Venda registrada: ${item.nome} | Qtd: ${prato.quantidade} | Receita: R$${prato.receita.toFixed(2)}`);
    });

    // Salva pedidos + vendas
    fs.writeFileSync(DB_PATH, JSON.stringify({ pedidos, vendas: json.vendas }, null, 2), 'utf-8');

  } catch (error) {
    console.error("❌ Erro ao atualizar vendas:", error);
  }

  res.status(201).json(novoPedido);
});



// Atualiza o status de um pedido
app.patch('/pedidos/:id', (req, res) => {
  const { id } = req.params;
  const pedido = pedidos.find(p => p.id === id);
  if (!pedido) {
    return res.status(404).json({ erro: "Pedido não encontrado" });
  }

  const novoStatus = req.body.status;

  if (novoStatus === 'entregue') {
    pedido.status = 'comendo';
    salvarPedidos();
    res.json(pedido);

    const mesa = pedido.mesa;
    setTimeout(() => {
      pedidos = pedidos.filter(p => p.mesa !== mesa);
      salvarPedidos();
    }, 300000); // 5 minutos
  } else {
    Object.assign(pedido, req.body);
    salvarPedidos();
    res.json(pedido);
  }
});

// Cria preferência de pagamento (Mercado Pago)
app.post('/pagamento', async (req, res) => {
  const pedido = req.body;

  try {
    const response = await axios.post(
      'https://api.mercadopago.com/checkout/preferences',
      {
        items: pedido.itens.map(item => ({
          title: item.nome,
          quantity: 1,
          currency_id: "BRL",
          unit_price: item.preco
        })),
        payer: {
          email: 'test_user_19653727@testuser.com'
        },
        back_urls: {
          success: "http://localhost:3000/sucesso.html",
          failure: "http://localhost:3000/erro.html",
          pending: "http://localhost:3000/pendente.html"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const initPoint = response.data.init_point;
    res.json({ url: initPoint });
  } catch (error) {
    console.error("Erro ao criar pagamento:", error.response?.data || error.message);
    res.status(500).json({ erro: "Erro ao criar pagamento" });
  }
});

// Gera um ID aleatório para pedido
function gerarId() {
  return Math.random().toString(36).substring(2, 6);
}

// Inicia o servidor
app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});


// Nova rota: análise de cardápio
app.get('/analise-cardapio', (req, res) => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const json = JSON.parse(data);
    const vendas = json.vendas || [];

    const analise = vendas.map(prato => {
      const custoTotal = prato.quantidade * prato.custo;
      const margem = prato.receita - custoTotal;
      const margemPercentual = prato.receita > 0 ? (margem / prato.receita) * 100 : 0;

      let recomendacao = "revisar";
      if (prato.quantidade > 5 && margem > 50) {
        recomendacao = "promover";
      } else if (prato.quantidade < 2 || margem <= 0) {
        recomendacao = "remover";
      }

      return {
        nome: prato.nome,
        quantidade: prato.quantidade,
        receita: prato.receita,
        margem: margem,
        margemPercentual: margemPercentual,
        recomendacao: recomendacao
      };
    });

    res.json(analise);
  } catch (error) {
    console.error("Erro na análise:", error);
    res.status(500).json({ erro: "Falha ao gerar análise de cardápio" });
  }
});
