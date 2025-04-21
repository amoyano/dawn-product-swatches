class ProductSwatches extends HTMLElement {
  constructor() {
    super();
    this.swatches = this.querySelectorAll('input[type="radio"]');
    this.productCard = this.closest('.card-wrapper');
    this.productImage = this.productCard?.querySelector('.card__media img:first-of-type');
    this.productImageContainer = this.productCard?.querySelector('.card__media');
    this.embeddedForm = this.querySelector('form');
    this.variantInput = this.embeddedForm?.querySelector('input[name="id"]');
    this.submitButton = this.embeddedForm?.querySelector('button[type="submit"]');
    this.submitButtonSpan = this.submitButton?.querySelector('span:not(.sold-out-message)');
    this.submitButtonSoldOutMessage = this.submitButton?.querySelector('.sold-out-message');
    this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    this.selectedVariantId = this.variantInput?.value;
    this.quantityThreshold = this.getAttribute('data-quantity-threshold');

    this.handleSwatchClick = this.handleSwatchClick.bind(this);
    this.handleAddSubmission = this.handleAddSubmission.bind(this);
  }

  connectedCallback() {
    if (!this.swatches.length || !this.productImageContainer || !this.embeddedForm || !this.submitButton) {
      console.warn('ProductSwatches: Missing required elements (swatches, image container, form, or submit button).');
      return;
    }
    const initialSelectedSwatch = this.querySelector('input[type="radio"]:checked');
    if (initialSelectedSwatch) {
       const available = initialSelectedSwatch.dataset.variantAvailable === 'true';
       const quantity = parseInt(initialSelectedSwatch.dataset.variantQuantity, 10);
       this.updateAddToCartButtonState(available, quantity);
       this.selectedVariantId = initialSelectedSwatch.dataset.variantId;
       this.variantInput.value = this.selectedVariantId;
    } else {
        this.updateAddToCartButtonState(false);
    }

    this.addEventListeners();
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }

  addEventListeners() {
    this.swatches.forEach(swatch => {
      swatch.addEventListener('click', this.handleSwatchClick);
    });
    this.submitButton?.addEventListener('click', this.handleAddSubmission);
  }

  removeEventListeners() {
    this.swatches.forEach(swatch => {
      swatch.removeEventListener('click', this.handleSwatchClick);
    });
    this.submitButton?.removeEventListener('click', this.handleAddSubmission);
  }

  handleSwatchClick(event) {
    const clickedSwatch = event.currentTarget;
    const variantImage = clickedSwatch.dataset.variantImage;
    const variantId = clickedSwatch.dataset.variantId;
    const variantAvailable = clickedSwatch.dataset.variantAvailable === 'true';
    const variantQuantity = clickedSwatch.dataset.variantQuantity ? parseInt(clickedSwatch.dataset.variantQuantity, 10) : Infinity;
    this.updateImage(variantImage);
    this.updateSwatchSelection(clickedSwatch);

    if (!variantId) return;

    this.selectedVariantId = variantId;
    this.variantInput.value = variantId;

    this.updateAddToCartButtonState(variantAvailable, variantQuantity);
  }

  updateImage(imageUrl) {
    if (!imageUrl || !this.productImage) return;

    this.productImage.src = imageUrl;
    this.productImage.removeAttribute('srcset');

     const secondaryImage = this.productImageContainer.querySelector('img:nth-of-type(2)');
     if (secondaryImage) {
        secondaryImage.style.display = 'none';
     }
  }

  updateSwatchSelection(selectedSwatch) {
     this.swatches.forEach(swatch => {
      swatch.classList.remove('is-selected');
      swatch.setAttribute('aria-checked', 'false');
    });
    selectedSwatch.classList.add('is-selected');
    selectedSwatch.setAttribute('aria-checked', 'true');
  }

  updateAddToCartButtonState(isAvailable, quantity = 0) {
    if (!this.submitButton || !this.submitButtonSpan) return;

     if (this.submitButtonSoldOutMessage) this.submitButtonSoldOutMessage.classList.add('hidden');
     if (this.submitButtonSpan) this.submitButtonSpan.classList.remove('hidden');

    if (isAvailable) {
      this.submitButton.disabled = false;
      this.submitButton.setAttribute('aria-disabled', 'false');
      if (quantity < this.quantityThreshold && quantity > 0) {
          const text = window.variantStrings.addToCartQuantity?.replace('[quantity]', quantity) || `Add to cart (${quantity} left)`;
          this.submitButtonSpan.textContent = text;
      } else {
          this.submitButtonSpan.textContent = window.variantStrings.addToCart || 'Add to cart';
      }
    } else {
      this.submitButton.disabled = true;
      this.submitButton.setAttribute('aria-disabled', 'true');
      this.submitButtonSpan.textContent = window.variantStrings.soldOut || 'OUT OF STOCK';
    }
  }

  handleAddSubmission(evt) {
    evt.preventDefault();

    if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

    this.submitButton.setAttribute('aria-disabled', true);
    this.submitButton.classList.add('loading');
    const spinner = this.submitButton.querySelector('.loading__spinner');
    if (spinner) spinner.classList.remove('hidden');

    const config = fetchConfig('javascript');
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    delete config.headers['Content-Type'];

    const formData = new FormData(this.embeddedForm);

    if (this.selectedVariantId !== formData.get('id')) {
      formData.set('id', this.selectedVariantId);
    }

    if (this.cart) {
      formData.append(
        'sections',
        this.cart.getSectionsToRender().map((section) => section.id)
      );
      formData.append('sections_url', window.location.pathname);
      this.cart.setActiveElement(document.activeElement);
    }
    config.body = formData;

    fetch(`${routes.cart_add_url}`, config)
      .then((response) => response.json())
      .then((response) => {
        if (response.status) {
          console.error('Cart Error:', response.description);
           if (typeof publish === 'function') {
             publish(PUB_SUB_EVENTS.cartError, {
               source: 'product-swatches',
               productVariantId: formData.get('id'),
               errors: response.errors || response.description,
               message: response.message,
             });
           }
          this.submitButtonSpan.textContent = window.theme?.strings?.soldOut || 'OUT OF STOCK';
          if(this.submitButtonSoldOutMessage) {
            this.submitButtonSpan.classList.add('hidden');
            this.submitButtonSoldOutMessage.classList.remove('hidden');
            this.submitButtonSoldOutMessage.textContent = response.description;
          }
          this.submitButton.setAttribute('aria-disabled', true);
          return;
        }

        const selectedSwatch = this.querySelector('input[type="radio"]:checked');
        if (selectedSwatch) {
          let currentQuantity = parseInt(selectedSwatch.dataset.variantQuantity, 10);
          if (!isNaN(currentQuantity)) {
             const originalQuantity = currentQuantity;
             currentQuantity -= 1;
             selectedSwatch.dataset.variantQuantity = currentQuantity;
             const isAvailable = currentQuantity > 0;
             selectedSwatch.dataset.variantAvailable = isAvailable.toString();

             this.updateAddToCartButtonState(isAvailable, currentQuantity);

             if (originalQuantity === 1 && !isAvailable) {
                this.submitButtonSpan.textContent = "You have added the last one!";
                this.submitButton.disabled = true;
                this.submitButton.setAttribute('aria-disabled', 'true');
                selectedSwatch.classList.add('visually-disabled');
             }
          }
        }

        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, {
            source: 'product-swatches',
            productVariantId: formData.get('id'),
            cartData: response,
          });
        }

        if (this.cart) {
            this.cart.renderContents(response);
        } else {
            window.location = window.routes.cart_url;
        }

      })
      .catch((e) => {
        console.error('Fetch Error:', e);
        this.submitButtonSpan.textContent = 'Error';
      })
      .finally(() => {
        this.submitButton.classList.remove('loading');
        if (spinner) spinner.classList.add('hidden');
        if (this.cart && this.cart.classList.contains('is-empty')) {
            this.cart.classList.remove('is-empty');
        }
      });
  }
}

if (!customElements.get('product-swatches')) {
  customElements.define('product-swatches', ProductSwatches);
} 