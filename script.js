// ========== NAVBAR SCROLL EFFECT ==========
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ========== MOBILE MENU ==========
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
    document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
});

navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// ========== COUNTER ANIMATION ==========
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        if (!target || counter.dataset.animated) return;

        const duration = 2000;
        const start = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            counter.textContent = Math.floor(target * eased).toLocaleString('fr-FR');
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                counter.textContent = target.toLocaleString('fr-FR');
                counter.dataset.animated = 'true';
            }
        }
        requestAnimationFrame(update);
    });
}

// ========== SCROLL REVEAL ==========
function setupReveal() {
    const revealElements = document.querySelectorAll(
        '.step-card, .pricing-card, .testimonial-card, .footer-grid > div'
    );
    revealElements.forEach(el => el.classList.add('reveal'));

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(el => observer.observe(el));
}

// ========== COUNTER TRIGGER ON SCROLL ==========
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounters();
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.hero-stats');
if (statsSection) statsObserver.observe(statsSection);

// ========== SMOOTH SCROLL FOR ALL ANCHORS ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
            e.preventDefault();
            targetEl.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ========== HERO PARALLAX ==========
window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const scrolled = window.scrollY;
    if (scrolled < window.innerHeight) {
        const heroImage = document.querySelector('.hero-image-wrapper');
        if (heroImage) {
            heroImage.style.transform = `translateY(${scrolled * 0.08}px)`;
        }
    }
});

// ========== MTN MOBILE MONEY PAYMENT MODAL ==========
const plans = {
    Solo:    { name: 'Solo',    price: '3 500', amount: 3500 },
    Duo:     { name: 'Duo',     price: '6 000', amount: 6000 },
    Famille: { name: 'Famille', price: '12 000', amount: 12000 }
};

let selectedPlan = null;
const modal = document.getElementById('paymentModal');

// Open modal from pricing buttons
document.getElementById('ctaSolo').addEventListener('click', (e) => { e.preventDefault(); openModal('Solo'); });
document.getElementById('ctaDuo').addEventListener('click', (e) => { e.preventDefault(); openModal('Duo'); });
document.getElementById('ctaFamille').addEventListener('click', (e) => { e.preventDefault(); openModal('Famille'); });

function openModal(planName) {
    selectedPlan = plans[planName];
    // Update modal content
    document.getElementById('modalPlanLabel').textContent = `Formule ${selectedPlan.name} — ${selectedPlan.price} FCFA`;
    document.getElementById('summaryPlan').textContent = selectedPlan.name;
    document.getElementById('summaryTotal').textContent = `${selectedPlan.price} FCFA`;

    // Reset to step 1
    goToStep(1);
    // Reset form fields
    document.getElementById('clientName').value = '';
    document.getElementById('clientAddress').value = '';
    document.getElementById('clientNotes').value = '';
    document.getElementById('momoPhone').value = '';
    // Remove error states
    document.querySelectorAll('.form-group input, .form-group textarea').forEach(el => el.classList.remove('error'));

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function goToStep(stepNumber) {
    document.querySelectorAll('.modal-step').forEach(s => s.classList.remove('active'));
    const target = document.querySelector(`.modal-step[data-step="${stepNumber}"]`);
    if (target) target.classList.add('active');
}

// Close modal
document.getElementById('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// Step 1 → Step 2
document.getElementById('toStep2').addEventListener('click', () => {
    const name = document.getElementById('clientName');
    const address = document.getElementById('clientAddress');
    let valid = true;

    [name, address].forEach(field => {
        field.classList.remove('error');
        if (!field.value.trim()) {
            field.classList.add('error');
            valid = false;
        }
    });

    if (valid) goToStep(2);
});

// Step 2 → Step 1 (back)
document.getElementById('backToStep1').addEventListener('click', () => goToStep(1));

// Step 2 → Step 3 (pay) - Appel réel à l'API MTN MoMo
document.getElementById('toStep3').addEventListener('click', () => {
    const phone = document.getElementById('momoPhone');
    phone.classList.remove('error');

    const phoneValue = phone.value.replace(/\s/g, '');
    if (phoneValue.length < 9) {
        phone.classList.add('error');
        return;
    }

    goToStep(3);
    processPayment();
});

// ========== APPEL RÉEL À L'API MTN MOMO ==========
async function processPayment() {
    const step1El = document.getElementById('procStep1');
    const step2El = document.getElementById('procStep2');
    const step3El = document.getElementById('procStep3');

    // Reset UI
    step1El.className = 'proc-step active';
    step1El.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connexion au serveur MTN';
    step2El.className = 'proc-step';
    step2El.innerHTML = '<i class="fas fa-circle"></i> Envoi de la demande de paiement';
    step3El.className = 'proc-step';
    step3El.innerHTML = '<i class="fas fa-circle"></i> Confirmation du paiement';

    try {
        // --- Étape 1 : Envoyer la demande de paiement au backend ---
        const paymentData = {
            amount: selectedPlan.amount,
            phone: document.getElementById('momoPhone').value.replace(/\s/g, ''),
            planName: selectedPlan.name,
            clientName: document.getElementById('clientName').value,
            clientAddress: document.getElementById('clientAddress').value,
            clientNotes: document.getElementById('clientNotes').value
        };

        step1El.className = 'proc-step done';
        step1El.innerHTML = '<i class="fas fa-circle-check"></i> Connexion au serveur MTN';
        step2El.className = 'proc-step active';
        step2El.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi de la demande de paiement';

        const response = await fetch('/api/momo/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Échec de l\'envoi du paiement');
        }

        step2El.className = 'proc-step done';
        step2El.innerHTML = '<i class="fas fa-circle-check"></i> Envoi de la demande de paiement';
        step3El.className = 'proc-step active';
        step3El.innerHTML = '<i class="fas fa-spinner fa-spin"></i> En attente de confirmation...';

        // --- Étape 2 : Polling du statut de la transaction ---
        const referenceId = result.referenceId;
        const externalId = result.externalId;
        let finalStatus = null;
        let financialTxnId = null;
        const maxAttempts = 30; // 30 tentatives × 3 secondes = 90 secondes max

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Attendre 3s

            try {
                const statusRes = await fetch(`/api/momo/status/${referenceId}`);
                const statusData = await statusRes.json();

                if (statusData.status === 'SUCCESSFUL') {
                    finalStatus = 'SUCCESSFUL';
                    financialTxnId = statusData.financialTransactionId;
                    break;
                } else if (statusData.status === 'FAILED') {
                    finalStatus = 'FAILED';
                    break;
                }
                // Si PENDING, on continue le polling
            } catch (pollError) {
                console.warn('Erreur polling:', pollError);
            }
        }

        // --- Étape 3 : Afficher le résultat ---
        if (finalStatus === 'SUCCESSFUL') {
            step3El.className = 'proc-step done';
            step3El.innerHTML = '<i class="fas fa-circle-check"></i> Paiement confirmé !';

            document.getElementById('orderNumber').textContent = externalId;
            document.getElementById('transactionId').textContent = financialTxnId || referenceId.substring(0, 12).toUpperCase();

            setTimeout(() => goToStep(4), 800);

        } else if (finalStatus === 'FAILED') {
            throw new Error('Le paiement a été refusé. Veuillez réessayer.');
        } else {
            // Timeout - pas de réponse après 90 secondes
            throw new Error('Délai d\'attente dépassé. Vérifiez votre téléphone et réessayez.');
        }

    } catch (error) {
        console.error('Erreur paiement:', error);

        step3El.className = 'proc-step';
        step3El.innerHTML = `<i class="fas fa-circle-xmark" style="color:#e74c3c"></i> ${error.message}`;

        // Ajouter un bouton "Réessayer" dans le modal
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn-modal-next';
        retryBtn.style.marginTop = '20px';
        retryBtn.innerHTML = '<i class="fas fa-redo"></i> Réessayer';
        retryBtn.onclick = () => {
            retryBtn.remove();
            goToStep(2);
        };

        const processingBody = document.querySelector('.modal-processing');
        if (processingBody && !processingBody.querySelector('.btn-modal-next')) {
            processingBody.appendChild(retryBtn);
        }
    }
}

// Done button
document.getElementById('modalDone').addEventListener('click', () => {
    closeModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    setupReveal();
});

