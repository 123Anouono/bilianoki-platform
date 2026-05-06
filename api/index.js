/**
 * ============================================
 * Bilianoki - Serveur Backend
 * Intégration MTN Mobile Money Collections API
 * ============================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Servir les fichiers HTML/CSS/JS (racine du projet, un niveau au-dessus de 'api')
app.use(express.static(path.join(__dirname, '../')));

// ============================================
// Configuration MTN MoMo
// ============================================
const MOMO_CONFIG = {
    baseUrl: process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com',
    subscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY,
    apiUser: process.env.MOMO_API_USER,
    apiKey: process.env.MOMO_API_KEY,
    environment: process.env.MOMO_ENVIRONMENT || 'sandbox',
    currency: process.env.MOMO_CURRENCY || 'XAF',
    callbackUrl: process.env.MOMO_CALLBACK_URL || 'http://localhost:3000/api/momo/callback'
};

// Stockage en mémoire des transactions (utiliser une BDD en production)
const transactions = new Map();

// ============================================
// Obtenir un token d'accès MTN MoMo
// ============================================
async function getMoMoAccessToken() {
    const credentials = Buffer.from(`${MOMO_CONFIG.apiUser}:${MOMO_CONFIG.apiKey}`).toString('base64');

    const response = await axios.post(
        `${MOMO_CONFIG.baseUrl}/collection/token/`,
        {},
        {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Ocp-Apim-Subscription-Key': MOMO_CONFIG.subscriptionKey
            }
        }
    );

    return response.data.access_token;
}

// ============================================
// ROUTE: Initier un paiement (Request to Pay)
// ============================================
app.post('/api/momo/pay', async (req, res) => {
    try {
        const { amount, phone, planName, clientName, clientAddress, clientNotes } = req.body;

        if (!amount || !phone || !planName) {
            return res.status(400).json({ success: false, error: 'Montant, téléphone et formule sont requis' });
        }

        let formattedPhone = phone.replace(/\s/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '242' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('242')) {
            formattedPhone = '242' + formattedPhone;
        }

        const accessToken = await getMoMoAccessToken();
        const referenceId = uuidv4();
        const externalId = `BLN-${Date.now()}`;

        const payload = {
            amount: String(amount),
            currency: MOMO_CONFIG.currency,
            externalId: externalId,
            payer: { partyIdType: 'MSISDN', partyId: formattedPhone },
            payerMessage: `Bilianoki - Commande ${planName}`,
            payeeNote: `Commande ${planName} pour ${clientName}`
        };

        await axios.post(
            `${MOMO_CONFIG.baseUrl}/collection/v1_0/requesttopay`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Reference-Id': referenceId,
                    'X-Target-Environment': MOMO_CONFIG.environment,
                    'Ocp-Apim-Subscription-Key': MOMO_CONFIG.subscriptionKey,
                    'Content-Type': 'application/json',
                    'X-Callback-Url': MOMO_CONFIG.callbackUrl
                }
            }
        );

        transactions.set(referenceId, {
            referenceId, externalId, amount, phone: formattedPhone, planName, clientName, clientAddress, clientNotes,
            status: 'PENDING', createdAt: new Date().toISOString()
        });

        console.log(`✅ Paiement initié - Ref: ${referenceId} - ${planName} - ${amount} ${MOMO_CONFIG.currency}`);

        res.status(202).json({
            success: true, referenceId, externalId, message: 'Demande de paiement envoyée. Veuillez confirmer sur votre téléphone.'
        });
    } catch (error) {
        console.error('❌ Erreur paiement:', error.response?.data || error.message);
        const errorMsg = error.response?.data?.message || error.message;
        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({ success: false, error: `Erreur lors du paiement: ${errorMsg}` });
    }
});

// ============================================
// ROUTE: Vérifier le statut d'un paiement
// ============================================
app.get('/api/momo/status/:referenceId', async (req, res) => {
    try {
        const { referenceId } = req.params;
        const accessToken = await getMoMoAccessToken();

        const response = await axios.get(
            `${MOMO_CONFIG.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Target-Environment': MOMO_CONFIG.environment,
                    'Ocp-Apim-Subscription-Key': MOMO_CONFIG.subscriptionKey
                }
            }
        );

        const momoStatus = response.data;

        if (transactions.has(referenceId)) {
            const txn = transactions.get(referenceId);
            txn.status = momoStatus.status;
            txn.financialTransactionId = momoStatus.financialTransactionId || null;
            transactions.set(referenceId, txn);
        }

        console.log(`📋 Statut ${referenceId}: ${momoStatus.status}`);

        res.json({
            success: true,
            status: momoStatus.status,
            financialTransactionId: momoStatus.financialTransactionId || null,
            externalId: momoStatus.externalId,
            amount: momoStatus.amount,
            currency: momoStatus.currency
        });
    } catch (error) {
        console.error('❌ Erreur statut:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: 'Impossible de vérifier le statut du paiement' });
    }
});

// ============================================
// ROUTE: Callback MTN MoMo (notification)
// ============================================
app.post('/api/momo/callback', (req, res) => {
    console.log('📨 Callback MoMo reçu:', JSON.stringify(req.body, null, 2));
    const { referenceId, status, financialTransactionId } = req.body;

    if (referenceId && transactions.has(referenceId)) {
        const txn = transactions.get(referenceId);
        txn.status = status;
        txn.financialTransactionId = financialTransactionId;
        transactions.set(referenceId, txn);
        console.log(`✅ Transaction ${referenceId} mise à jour: ${status}`);
    }

    res.status(200).send('OK');
});

// ============================================
// ROUTE: Page d'accueil
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// ============================================
// Exportation pour Vercel (Important)
// ============================================
module.exports = app;

// Démarrer le serveur seulement si on n'est pas sur Vercel
if (process.env.NODE_ENV !== 'production' || process.env.START_SERVER === 'true') {
    app.listen(PORT, () => {
        console.log('\n' + '='.repeat(50));
        console.log('🍲 Bilianoki - Serveur démarré');
        console.log('='.repeat(50));
        console.log(`\n🌐 Site web    : http://localhost:${PORT}`);
        console.log(`💰 API Paiement: http://localhost:${PORT}/api/momo/pay`);
        console.log(`📊 API Statut  : http://localhost:${PORT}/api/momo/status/:id`);
        console.log(`\n🔧 Environnement MoMo: ${MOMO_CONFIG.environment}`);

        if (!MOMO_CONFIG.subscriptionKey || MOMO_CONFIG.subscriptionKey === 'your_subscription_key_here') {
            console.log('\n⚠️  ATTENTION: Configurez vos clés MTN MoMo dans le fichier .env');
            console.log('   Exécutez "npm run setup-momo" après avoir ajouté votre Subscription Key');
        }

        console.log('\n' + '='.repeat(50) + '\n');
    });
}
