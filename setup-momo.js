/**
 * ============================================
 * Script de configuration initiale MTN MoMo API
 * ============================================
 * 
 * Ce script crée automatiquement un API User et un API Key
 * sur le sandbox MTN MoMo. Exécutez-le une seule fois :
 * 
 *   npm run setup-momo
 * 
 * Pré-requis :
 * 1. Créez un compte sur https://momodeveloper.mtn.com
 * 2. Abonnez-vous au produit "Collections"
 * 3. Copiez votre Subscription Key (Primary Key) dans .env
 */

require('dotenv').config();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
const SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY;

async function setupMoMo() {
    if (!SUBSCRIPTION_KEY || SUBSCRIPTION_KEY === 'your_subscription_key_here') {
        console.error('\n❌ ERREUR: Vous devez d\'abord configurer votre MOMO_SUBSCRIPTION_KEY dans le fichier .env');
        console.log('\n📋 Étapes à suivre :');
        console.log('   1. Allez sur https://momodeveloper.mtn.com');
        console.log('   2. Créez un compte et connectez-vous');
        console.log('   3. Allez dans "Products" > "Collections" > "Subscribe"');
        console.log('   4. Allez dans votre profil pour trouver la "Primary Key"');
        console.log('   5. Collez cette clé dans le fichier .env à la ligne MOMO_SUBSCRIPTION_KEY\n');
        process.exit(1);
    }

    const apiUserId = uuidv4();

    try {
        // Étape 1 : Créer un API User
        console.log('\n🔧 Étape 1/3 : Création de l\'API User...');
        await axios.post(`${BASE_URL}/v1_0/apiuser`, {
            providerCallbackHost: 'localhost:3000'
        }, {
            headers: {
                'X-Reference-Id': apiUserId,
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                'Content-Type': 'application/json'
            }
        });
        console.log(`   ✅ API User créé : ${apiUserId}`);

        // Étape 2 : Générer l'API Key
        console.log('\n🔧 Étape 2/3 : Génération de l\'API Key...');
        const keyResponse = await axios.post(
            `${BASE_URL}/v1_0/apiuser/${apiUserId}/apikey`,
            {},
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
                }
            }
        );
        const apiKey = keyResponse.data.apiKey;
        console.log(`   ✅ API Key générée : ${apiKey}`);

        // Étape 3 : Vérifier l'API User
        console.log('\n🔧 Étape 3/3 : Vérification...');
        const verifyResponse = await axios.get(
            `${BASE_URL}/v1_0/apiuser/${apiUserId}`,
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
                }
            }
        );
        console.log(`   ✅ API User vérifié - Environment: ${verifyResponse.data.targetEnvironment}`);

        // Afficher les résultats
        console.log('\n' + '='.repeat(60));
        console.log('🎉 CONFIGURATION TERMINÉE AVEC SUCCÈS !');
        console.log('='.repeat(60));
        console.log('\n📝 Mettez à jour votre fichier .env avec ces valeurs :\n');
        console.log(`   MOMO_API_USER=${apiUserId}`);
        console.log(`   MOMO_API_KEY=${apiKey}`);
        console.log('\n' + '='.repeat(60));
        console.log('\n▶️  Ensuite, lancez le serveur avec : npm start\n');

    } catch (error) {
        console.error('\n❌ Erreur lors de la configuration :', error.response?.data || error.message);
        if (error.response?.status === 401) {
            console.log('\n💡 Vérifiez que votre MOMO_SUBSCRIPTION_KEY est correcte dans .env');
        }
    }
}

setupMoMo();
