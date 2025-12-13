import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import axios from "axios";
import crypto from "crypto";
import { fileURLToPath } from "url";

// Mercado Pago SDK v2
import { MercadoPagoConfig, Payment } from "mercadopago";

// =============================
// Ajustes ES MODULES
// =============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use("/imagens", express.static(path.join(process.cwd(), "imagens")));
console.log("IMAGENS EM:", path.join(process.cwd(), "imagens"));

app.use(cors());
app.use(express.json());

// =============================
// ROTAS DE ARQUIVOS HTML
// =============================
app.get("/gestor-login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "gestor-login.html"));
});

app.get("/gestor.html", (req, res) => {
  res.sendFile(path.join(__dirname, "gestor.html"));
});

app.get("/cozinha.html", (req, res) => {
  res.sendFile(path.join(__dirname, "cozinha.html"));
});

app.get("/relatorio.html", (req, res) => {
  res.sendFile(path.join(__dirname, "relatorio.html"));
});

// ROTA DO QR CODE SIMULADO
app.get("/mesa_qr_code.html", (req, res) => {
  res.sendFile(path.join(__dirname, "mesa_qr_code.html"));
});

// === ROTA PRINCIPAL: GERA MESA ALEATÓRIA E REDIRECIONA ===
app.get("/mesa-aleatoria", (req, res) => {
    // Escolhe aleatoriamente entre mesas
    const mesaAleatoria = Math.floor(Math.random() * 5) + 1;
    
    // Redireciona o cliente para o cardápio da mesa aleatória
    res.redirect(`/index.html?mesa=${mesaAleatoria}`);
});
// ========================================================

const DB_PATH = path.join(__dirname, "db.json");

// =============================
// Mercado Pago SDK
// =============================
const ACCESS_TOKEN = "TEST-6035047548343306-062222-92c47ab4de3216b61ea3dd308b6c8d93-2019074163"; //

const mpClient = new MercadoPagoConfig({
  accessToken: ACCESS_TOKEN,
});

const mpPayment = new Payment(mpClient);

// =============================
// Sessões simples
// =============================
const sessions = {};

// -----------------------------
// Funções auxiliares
// -----------------------------
function loadDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const init = {
        pedidos: [],
        vendas: [],
        pratos: [],
        gestor: { usuario: "admin", senha: "1234" },
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2), "utf8");
      return init;
    }
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Erro carregar DB:", e);
    return {
      pedidos: [],
      vendas: [],
      pratos: [],
      gestor: { usuario: "admin", senha: "1234" },
    };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function gerarId(prefix = "x") {
  return prefix + Math.random().toString(36).substring(2, 9);
}

function gerarToken() {
  return Math.random().toString(36).substring(2, 16);
}

// Middleware de autenticação
function requireAuth(req, res, next) {
  const token = req.headers["x-auth-token"] || req.query.token;
  if (!token) return res.status(401).json({ erro: "Token ausente" });

  const sess = sessions[token];
  if (!sess) return res.status(401).json({ erro: "Sessão inválida" });

  next();
}

// =============================
// CARREGAR PEDIDOS AO INICIAR
// =============================
let pedidos = [];
(function initPedidos() {
  const db = loadDB();
  pedidos = db.pedidos || [];
})();

// =============================
// ROTAS DE PEDIDOS (CRUD)
// =============================
app.get("/pedidos", (req, res) => {
  const mesasStatus = [1, 2, 3, 4, 5].map((num) => {
    const pedidoMesa = pedidos.find((p) => p.mesa === String(num));

    let status = "livre";
    if (pedidoMesa?.status === "pago") status = "pago";
    else if (pedidoMesa?.status === "comendo") status = "comendo";
    else if (pedidoMesa?.status === "aguardando" || pedidoMesa?.status === "pendente")
      status = "aguardando";

    return { mesa: String(num), status };
  });

  res.json({ mesas: mesasStatus, pedidos });
});

app.post("/pedidos", (req, res) => {
  // Adiciona payment_id e status inicial
  const novoPedido = { id: gerarId("o"), payment_id: null, status: 'aguardando', ...req.body }; 
  pedidos.push(novoPedido);

  try {
    const db = loadDB();
    if (!db.vendas) db.vendas = [];

    novoPedido.itens.forEach((item) => {
      const categoria = item.categoria || "Outros";
      let registro = db.vendas.find((v) => v.nome === item.nome);

      if (!registro) {
        registro = {
          nome: item.nome,
          categoria,
          custo: item.custo || item.preco * 0.5,
          quantidade: 0,
          receita: 0,
        };
        db.vendas.push(registro);
      }

      registro.quantidade += 1;
      registro.receita = +(registro.receita + Number(item.preco)).toFixed(2);
    });

    db.pedidos = pedidos;
    saveDB(db);
  } catch (e) {
    console.error("Erro ao atualizar vendas:", e);
  }

  res.status(201).json(novoPedido);
});

app.patch("/pedidos/:id", (req, res) => {
  const { id } = req.params;
  const pedido = pedidos.find((p) => p.id === id);

  if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });

  const novoStatus = req.body.status;

  if (novoStatus === "entregue") {
    // Altera de 'aguardando' (Cozinha) para 'comendo' (Cliente)
    pedido.status = "comendo";

    const mesa = pedido.mesa;

    // === TEMPORIZADOR ===
    const tempoLiberacao = 35000; 
    console.log(`[Timer] Mesa ${mesa} mudou para comendo. Será liberada em 35 segundos.`);

    setTimeout(() => {
      pedidos = pedidos.filter((p) => p.mesa !== mesa);
      const db = loadDB();
      db.pedidos = pedidos;
      saveDB(db);
      console.log(`[Timer] Mesa ${mesa} liberada automaticamente.`);
    }, tempoLiberacao); 
    // ===================================

    return res.json(pedido);
  }

  Object.assign(pedido, req.body);

  const db = loadDB();
  db.pedidos = pedidos;
  saveDB(db);

  res.json(pedido);
});


// =============================
// CRIAÇÃO DE PAGAMENTO PIX
// =============================
app.post("/create_pix", async (req, res) => {
  console.log("======== REQUISIÇÃO /create_pix =========");
  console.log("BODY RECEBIDO:", req.body);
  console.log("=========================================");

  try {
    const { total, id: pedidoId } = req.body;

    if (!total || Number(total) <= 0) {
      return res.status(400).json({
        erro: "Valor total inválido",
        recebido: req.body,
      });
    }

    const idempotencyKey = crypto.randomUUID();

    const pagamento = await mpPayment.create({
      body: {
        transaction_amount: Number(total),
        description: "Pagamento via PIX - PagZap",
        payment_method_id: "pix",
        payer: {
          email: "cliente@example.com",
        },
      },
      requestOptions: { idempotencyKey },
    });

    console.log("SUCESSO MP, ID PAGAMENTO:", pagamento.id);
    console.log("STATUS MP:", pagamento.status);

    // === ATUALIZAÇÃO DO PEDIDO COM O PAYMENT ID ===
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (pedido) {
      pedido.payment_id = pagamento.id;
      // O status permanece 'aguardando' ou 'pendente'
      const db = loadDB();
      db.pedidos = pedidos;
      saveDB(db);
    }
    // ==============================================

    const pix = pagamento.point_of_interaction.transaction_data;
    
    return res.json({
      payment: {
        payment_id: pagamento.id,
        qr_code_base64: pix.qr_code_base64,
        qr_code: pix.qr_code,
        ticket_url: pix.ticket_url,
        transaction_amount: pagamento.transaction_amount
      }
    });
  } catch (error) {
    console.log("========= ERRO AO CRIAR PIX =========");
    console.log(error);
    console.log("=====================================");

    res.status(500).json({ erro: "Erro ao criar pagamento PIX" });
  }
});

// ==========================================================
// SIMULAÇÃO DE APROVAÇÃO SIMPLIFICADA (MOCK LOCAL)
// ==========================================================
app.patch("/pagamentos/:id/aprovar", async (req, res) => {
    const { id } = req.params;
    
    console.log(`[MOCK SIMULAÇÃO] Aprovando pagamento PIX ID: ${id}`);
    
    // MOCK: Simula o sucesso imediato no Sandbox (aprovado)
    const status_simulado = 'approved';

    try {
        const pedidoIndex = pedidos.findIndex(p => p.payment_id === id);
        
        if (pedidoIndex !== -1) {
            // Marca o pedido como 'aguardando' (cozinha processa a entrega)
            pedidos[pedidoIndex].status = 'aguardando'; 
            
            const db = loadDB();
            db.pedidos = pedidos;
            saveDB(db);
            
            console.log(`[DB] Pagamento PIX ID ${id} aprovado. Status do pedido mantido em 'aguardando' para a cozinha.`);
        } else {
            console.log(`[DB] Aviso: Nenhum pedido encontrado com o Payment ID ${id}.`);
        }

        return res.json({ ok: true, status: status_simulado, payment_id: id });

    } catch (error) {
        console.error("[MOCK SIMULAÇÃO ERROR]", error);
        return res.status(500).json({ ok: false, erro: "Falha na simulação de aprovação local." });
    }
});


// =============================
// ANALISE CARDÁPIO (MENU ENGINEERING)
// =============================
app.get("/analise-cardapio", (req, res) => {
  try {
    const db = loadDB();
    const vendas = db.vendas || [];

    if (vendas.length === 0) {
      return res.json([]);
    }

    // 1. CALCULAR MÉTRICAS BASE
    const analiseBase = vendas.map((prato) => {
      const custoTotal = prato.quantidade * (prato.custo || prato.preco * 0.5);
      const margem = prato.receita - custoTotal;
      const margemPorItem = margem / prato.quantidade;

      return {
        ...prato,
        margemTotal: +(margem).toFixed(2),
        margemPorItem: +(margemPorItem).toFixed(2),
      };
    });

    // 2. CALCULAR MÉDIAS GLOBAIS
    const totalQuantidade = analiseBase.reduce((s, p) => s + p.quantidade, 0);
    const totalItens = analiseBase.length;
    const totalMargemPorItem = analiseBase.reduce((s, p) => s + p.margemPorItem, 0);

    const mediaPopularidade = totalQuantidade / totalItens;
    const mediaMargemPorItem = totalMargemPorItem / totalItens;

    // 3. APLICAR CLASSIFICAÇÃO MENU ENGINEERING
    const analiseFinal = analiseBase.map((prato) => {
      const altaPopularidade = prato.quantidade > mediaPopularidade;
      const altaMargem = prato.margemPorItem > mediaMargemPorItem;

      let recomendacao = "";
      let classificacao = "";
      
      // Estrela (Star): Alta Popularidade, Alta Margem
      if (altaPopularidade && altaMargem) {
        classificacao = "Estrela";
        recomendacao = "Manter e promover agressivamente";
      } 
      // Quebra-cabeça (Puzzle): Baixa Popularidade, Alta Margem
      else if (!altaPopularidade && altaMargem) {
        classificacao = "Quebra-cabeça";
        recomendacao = "Aumentar visibilidade no cardápio";
      } 
      // Arado (Plow Horse): Alta Popularidade, Baixa Margem
      else if (altaPopularidade && !altaMargem) {
        classificacao = "Arado";
        recomendacao = "Aumentar preço ou reduzir custo";
      } 
      // Cão (Dog): Baixa Popularidade, Baixa Margem
      else {
        classificacao = "Cão";
        recomendacao = "Remover ou tentar aumentar a margem";
      }

      return {
        ...prato,
        classificacao,
        recomendacao,
      };
    });

    res.json({
      analise: analiseFinal,
      medias: {
        popularidade: +(mediaPopularidade).toFixed(2),
        margem: +(mediaMargemPorItem).toFixed(2),
      },
    });

  } catch (err) {
    console.error("Erro análise:", err);
    res.status(500).json({ erro: "Falha ao gerar análise" });
  }
});

// =============================
// AUTENTICAÇÃO
// =============================
app.post("/login", (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha)
    return res.status(400).json({ erro: "Usuário/senha obrigatórios" });

  const db = loadDB();
  const gestor = db.gestor;

  if (usuario === gestor.usuario && senha === gestor.senha) {
    const token = gerarToken();

    sessions[token] = {
      usuario,
      exp: Date.now() + 6 * 60 * 60 * 1000,
    };

    return res.json({ token });
  }

  res.status(401).json({ erro: "Credenciais inválidas" });
});

app.post("/logout", (req, res) => {
  const token = req.headers["x-auth-token"] || req.body.token;
  if (token && sessions[token]) delete sessions[token];
  res.json({ ok: true });
});

// =============================
// CRUD DE PRATOS
// =============================
app.get("/pratos", (req, res) => {
  const db = loadDB();
  res.json(db.pratos || []);
});

app.post("/pratos", requireAuth, (req, res) => {
  const { nome, preco, categoria, imagem } = req.body;
  if (!nome || preco === undefined)
    return res.status(400).json({ erro: "Nome e preço obrigatórios" });

  const db = loadDB();

  const novo = {
    id: gerarId("p"),
    nome,
    preco: Number(preco),
    categoria: categoria || "Outros",
    imagem: imagem || "",
  };

  db.pratos.push(novo);
  saveDB(db);

  res.status(201).json(novo);
});

app.put("/pratos/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const idx = db.pratos.findIndex((p) => p.id === id);

  if (idx < 0) return res.status(404).json({ erro: "Prato não encontrado" });

  const prato = db.pratos[idx];
  const { nome, preco, categoria, imagem } = req.body;

  if (nome) prato.nome = nome;
  if (preco !== undefined) prato.preco = Number(preco);
  if (categoria) prato.categoria = categoria;
  if (imagem) prato.imagem = imagem;

  db.pratos[idx] = prato;
  saveDB(db);

  res.json(prato);
});

app.delete("/pratos/:id", requireAuth, (req, res) => {
  const { id } = req.params;

  const db = loadDB();
  const antes = db.pratos.length;
  db.pratos = db.pratos.filter((p) => p.id !== id);

  if (db.pratos.length === antes)
    return res.status(404).json({ erro: "Prato não encontrado" });

  saveDB(db);

  res.json({ ok: true });
});

// =============================
// Arquivo inicial
// =============================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
// === ROTA EXPLICITA PARA INDEX.HTML CORRIGIDA ===
app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
// ===============================================

// =============================
// Start server
// =============================
const PORT = 3000;
app.listen(PORT, () =>
  console.log(`Servidor rodando em http://localhost:${PORT}`)

);
