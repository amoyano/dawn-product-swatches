/**
 * Custom element for handling product swatches, updating images, and managing variant selection.
 */
class ProductSwatches extends HTMLElement {
  constructor() {
    super();

    // Constants
    this.classes = {
      hidden: 'hidden',
      loading: 'loading',
      isSelected: 'is-selected',
      visuallyDisabled: 'visually-disabled',
    };
    this.selectors = {
      swatches: 'input[type="radio"]',
      productCard: '.card-wrapper',
      productImage: '.card__media img:first-of-type',
      secondaryImage: '.card__media img:nth-of-type(2)',
      productImageContainer: '.card__media',
      embeddedForm: 'form',
      variantInput: 'input[name="id"]',
      submitButton: 'button[type="submit"]',
      submitButtonSpan: 'span:not(.sold-out-message)',
      submitButtonSoldOutMessage: '.sold-out-message',
      cart: 'cart-notification, cart-drawer',
      spinner: '.loading__spinner',
      // Price related selectors within the product card
      priceContainer: '.price',
      priceRegular: '.price__regular .price-item--regular',
      priceSale: '.price__sale .price-item--sale',
      priceCompareAt: '.price__sale s.price-item--regular',
    };

    // DOM Elements
    this.swatches = this.querySelectorAll(this.selectors.swatches);
    this.productCard = this.closest(this.selectors.productCard);
    this.productImageContainer = this.productCard?.querySelector(this.selectors.productImageContainer);
    this.productImage = this.productImageContainer?.querySelector(this.selectors.productImage);
    this.embeddedForm = this.querySelector(this.selectors.embeddedForm);
    this.variantInput = this.embeddedForm?.querySelector(this.selectors.variantInput);
    this.submitButton = this.embeddedForm?.querySelector(this.selectors.submitButton);
    this.submitButtonSpan = this.submitButton?.querySelector(this.selectors.submitButtonSpan);
    this.submitButtonSoldOutMessage = this.submitButton?.querySelector(this.selectors.submitButtonSoldOutMessage);
    this.spinner = this.submitButton?.querySelector(this.selectors.spinner);
    this.cart = document.querySelector(this.selectors.cart);
    // Price related elements
    this.priceContainer = this.productCard?.querySelector(this.selectors.priceContainer);
    this.priceRegularElement = this.priceContainer?.querySelector(this.selectors.priceRegular);
    this.priceSaleElement = this.priceContainer?.querySelector(this.selectors.priceSale);
    this.priceCompareAtElement = this.priceContainer?.querySelector(this.selectors.priceCompareAt);

    // State
    this.selectedVariantId = this.variantInput?.value;
    this.quantityThreshold = parseInt(this.getAttribute('data-quantity-threshold') || '1', 10);
    this.addedMessageTimeout = null;

    this.handleSwatchClick = this.handleSwatchClick.bind(this);
    this.handleAddSubmission = this.handleAddSubmission.bind(this);
  }

  /**
   * Called when the element is added to the document's DOM.
   * Checks for required elements, sets initial state, and adds event listeners.
   */
  connectedCallback() {
    if (!this.swatches.length || !this.productImageContainer || !this.embeddedForm || !this.submitButton || !this.variantInput) {
      console.warn('ProductSwatches: Missing required elements (swatches, image container, form, variant input, or submit button).');
      return;
    }

    this.updateInitialState();
    this.addEventListeners();
  }

  /**
   * Called when the element is removed from the document's DOM.
   * Removes event listeners to prevent memory leaks.
   */
  disconnectedCallback() {
    this.removeEventListeners();
  }

  /**
   * Adds necessary event listeners for swatch clicks and form submission.
   */
  addEventListeners() {
    this.swatches.forEach(swatch => {
      swatch.addEventListener('click', this.handleSwatchClick);
    });
    this.submitButton?.addEventListener('click', this.handleAddSubmission);
  }

  /**
   * Removes event listeners previously added.
   */
  removeEventListeners() {
    this.swatches.forEach(swatch => {
      swatch.removeEventListener('click', this.handleSwatchClick);
    });
    this.submitButton?.removeEventListener('click', this.handleAddSubmission);
  }

  /**
   * Handles click events on swatches.
   * Updates the product image, swatch selection, hidden input value, and Add to Cart button state.
   * @param {Event} event - The click event object.
   */
  handleSwatchClick = (event) => {
    const clickedSwatch = event.currentTarget;
    const {
        variantImage,
        variantId,
        variantAvailable: variantAvailableStr,
        variantQuantity: variantQuantityStr,
        variantPrice,
        variantCompareAtPrice
    } = clickedSwatch.dataset;

    const variantAvailable = variantAvailableStr === 'true';
    const variantQuantity = variantQuantityStr ? parseInt(variantQuantityStr, 10) : Infinity;
    if (isNaN(variantQuantity)) variantQuantity = Infinity;

    this.updateImage(variantImage);
    this.updateSwatchSelection(clickedSwatch);

    if (!variantId) return;

    this.selectedVariantId = variantId;
    this.variantInput.value = variantId;

    this.updateAddToCartButtonState(variantAvailable, variantQuantity);
    this.updatePrice(variantPrice, variantCompareAtPrice);
  }

  /**
   * Updates the main product image based on the selected variant.
   * @param {string | null} imageUrl - The URL of the variant image.
   */
  updateImage(imageUrl) {
    if (!imageUrl || !this.productImage) return;

    this.productImage.src = imageUrl;
    this.productImage.removeAttribute('srcset');

    const secondaryImage = this.productImageContainer?.querySelector(this.selectors.secondaryImage);
    if (secondaryImage) {
        secondaryImage.style.display = 'none';
    }
  }

  /**
   * Updates the visual state (styling and ARIA attributes) of the swatches.
   * @param {HTMLElement} selectedSwatch - The swatch element that was clicked.
   */
  updateSwatchSelection(selectedSwatch) {
     this.swatches.forEach(swatch => {
      swatch.classList.remove(this.classes.isSelected);
      swatch.setAttribute('aria-checked', 'false');
    });
    selectedSwatch.classList.add(this.classes.isSelected);
    selectedSwatch.setAttribute('aria-checked', 'true');
  }

  /**
   * Updates the state (text, disabled status, ARIA attributes) of the Add to Cart button.
   * @param {boolean} isAvailable - Whether the selected variant is available.
   * @param {number} quantity - The available quantity of the selected variant.
   */
  updateAddToCartButtonState(isAvailable, quantity = 0) {
    if (!this.submitButton || !this.submitButtonSpan) return;

    if (this.submitButtonSoldOutMessage) this.submitButtonSoldOutMessage.classList.add(this.classes.hidden);
    if (this.submitButtonSpan) this.submitButtonSpan.classList.remove(this.classes.hidden);

    this.submitButton.disabled = !isAvailable;
    this.submitButton.setAttribute('aria-disabled', String(!isAvailable));

    if (isAvailable) {
      const defaultText = window.variantStrings?.addToCart ?? 'Add to cart';
      const quantityTextTemplate = window.variantStrings?.addToCartQuantity ?? `Add to cart ([quantity] left)`;

      // Determine text based on quantity
      const showQuantity = quantity < this.quantityThreshold && quantity > 0;
      this.submitButtonSpan.textContent = showQuantity
        ? quantityTextTemplate.replace('[quantity]', quantity)
        : defaultText;

    } else {
      this.submitButtonSpan.textContent = window.variantStrings?.soldOut ?? 'OUT OF STOCK';
    }
  }

  /**
   * Handles the submission of the product form via the Add to Cart button.
   * Uses async/await for the fetch request to add the item to the cart.
   * Updates button state, handles errors, and updates UI based on the response.
   * @param {Event} evt - The click event object.
   */
  handleAddSubmission = async (evt) => {
    evt.preventDefault();

    if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

    this.submitButton.setAttribute('aria-disabled', 'true');
    this.submitButton.classList.add(this.classes.loading);
    if (this.spinner) this.spinner.classList.remove(this.classes.hidden);

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

    const config = fetchConfig('javascript');
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    delete config.headers['Content-Type'];
    config.body = formData;

    try {
      const response = await fetch(`${routes.cart_add_url}`, config);
      const responseData = await response.json();

      if (!response.ok || responseData.status) {
        const errorDescription = responseData.description || responseData.message || 'Unknown error';
        console.error('Cart Error:', errorDescription, responseData.errors || '');
        this.handleCartError(formData.get('id'), responseData, errorDescription);
        return;
      }

      this.handleCartSuccess(formData.get('id'), responseData);

    } catch (e) {
      console.error('Fetch Error:', e);
      this.submitButtonSpan.textContent = window.variantStrings?.error ?? 'Error';
      this.submitButton.setAttribute('aria-disabled', 'true');

    } finally {
      this.submitButton.classList.remove(this.classes.loading);
      if (this.spinner) this.spinner.classList.add(this.classes.hidden);
      if (this.cart && this.cart.classList.contains('is-empty')) {
          this.cart.classList.remove('is-empty');
      }
    }
  }

  // --- Helper methods for handleAddSubmission ---

  /**
   * Handles errors received from the cart add endpoint.
   * Updates the button state and optionally displays an error message.
   * @param {string} variantId - The ID of the variant that failed to add.
   * @param {object} response - The error response object from the fetch call.
   * @param {string} description - The error description text.
   */
  handleCartError(variantId, response, description) {
    const soldOutText = window.theme?.strings?.soldOut ?? 'OUT OF STOCK';
    if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      publish(PUB_SUB_EVENTS.cartError, {
        source: 'product-swatches',
        productVariantId: variantId,
        errors: response.errors || description,
        message: response.message,
      });
    }

    this.submitButtonSpan.textContent = soldOutText;
    if (this.submitButtonSoldOutMessage) {
      this.submitButtonSpan.classList.add(this.classes.hidden);
      this.submitButtonSoldOutMessage.classList.remove(this.classes.hidden);
      this.submitButtonSoldOutMessage.textContent = description;
    }
    this.submitButton.setAttribute('aria-disabled', 'true');
  }

  /**
   * Handles successful responses from the cart add endpoint.
   * Updates variant quantity, publishes events, and renders cart updates.
   * @param {string} variantId - The ID of the variant successfully added.
   * @param {object} responseData - The success response object from the fetch call.
   */
  handleCartSuccess(variantId, responseData) {
    const selectedSwatch = this.querySelector(`${this.selectors.swatches}[data-variant-id="${variantId}"]`);
    if (selectedSwatch) {
      this.updateVariantQuantity(selectedSwatch);
    } else {
      console.warn('ProductSwatches: Could not find the added variant swatch to update quantity.');
    }

    if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'product-swatches',
        productVariantId: variantId,
        cartData: responseData,
      });
    }

    if (this.cart) {
        this.cart.renderContents(responseData);
    } else {
        window.location = window.routes.cart_url;
    }
  }

  /**
   * Updates the quantity dataset attributes on a swatch element after an item is added to the cart,
   * and triggers an update of the Add to Cart button state, potentially showing a temporary "Added!" message.
   * @param {HTMLElement} swatch - The swatch element corresponding to the added variant.
   */
  updateVariantQuantity(swatch) {
    let currentQuantity = parseInt(swatch.dataset.variantQuantity, 10);

    if (this.addedMessageTimeout) {
      clearTimeout(this.addedMessageTimeout);
      this.addedMessageTimeout = null;
    }

    if (!isNaN(currentQuantity)) {
      const originalQuantity = currentQuantity;
      currentQuantity = Math.max(0, currentQuantity - 1);
      swatch.dataset.variantQuantity = currentQuantity;

      const isAvailable = currentQuantity > 0;
      swatch.dataset.variantAvailable = String(isAvailable);

      if (!isAvailable && originalQuantity === 1) {
          this.submitButtonSpan.textContent = window.variantStrings?.lastItemAdded ?? "Last one added!";
          swatch.classList.add(this.classes.visuallyDisabled);
          this.submitButton.disabled = true;
          this.submitButton.setAttribute('aria-disabled', 'true');
      } else if (isAvailable) {
          const addedText = window.variantStrings?.added ?? "Added!";
          this.submitButtonSpan.textContent = addedText;
          this.submitButton.disabled = true;
          this.submitButton.setAttribute('aria-disabled', 'true');

          this.addedMessageTimeout = setTimeout(() => {
              const latestQuantity = parseInt(swatch.dataset.variantQuantity, 10);
              const latestAvailable = latestQuantity > 0;
              if (swatch.dataset.variantId === this.selectedVariantId) {
                this.updateAddToCartButtonState(latestAvailable, latestQuantity);
              }
              this.addedMessageTimeout = null;
          }, 3000);
      } else {
         this.updateAddToCartButtonState(isAvailable, currentQuantity);
      }
    } else {
      console.warn('ProductSwatches: Could not parse variant quantity for update.');
      this.updateAddToCartButtonState(false);
      swatch.dataset.variantAvailable = 'false';
    }
  }

  /**
   * Sets the initial state of the component based on the initially checked swatch (if any).
   * Updates the Add to Cart button state accordingly.
   */
  updateInitialState() {
    const initialSelectedSwatch = this.querySelector(`${this.selectors.swatches}:checked`);
    if (initialSelectedSwatch) {
       const {
           variantId,
           variantAvailable: availableStr,
           variantQuantity: quantityStr,
           variantPrice,
           variantCompareAtPrice
       } = initialSelectedSwatch.dataset;

       const available = availableStr === 'true';
       let quantity = quantityStr ? parseInt(quantityStr, 10) : 0;
       if (isNaN(quantity)) quantity = 0;

       this.updateAddToCartButtonState(available, quantity);
       this.selectedVariantId = variantId;
       this.variantInput.value = variantId;
       this.updatePrice(variantPrice, variantCompareAtPrice);

    } else {
        this.updateAddToCartButtonState(false);
        this.selectedVariantId = null;
        this.variantInput.value = '';
    }
  }

  /**
   * Updates the displayed price on the product card based on the selected variant.
   * @param {string} price - The formatted price of the selected variant.
   * @param {string | null} compareAtPrice - The formatted compare-at price (or null/empty if none).
   */
  updatePrice(price, compareAtPrice) {
    if (!this.priceContainer || !price) return;

    const hasComparePrice = compareAtPrice && compareAtPrice !== price;

    if (hasComparePrice) {
      if (this.priceRegularElement) this.priceRegularElement.textContent = price;
      if (this.priceSaleElement) this.priceSaleElement.textContent = price;
      if (this.priceCompareAtElement) {
        this.priceCompareAtElement.textContent = compareAtPrice;
         const saleContainer = this.priceCompareAtElement.closest('.price__sale');
         if (saleContainer) saleContainer.classList.remove(this.classes.hidden);
         const regularContainer = this.priceContainer.querySelector('.price__regular');
          if(regularContainer) regularContainer.classList.add(this.classes.hidden);
      }
      this.priceContainer.classList.add('price--on-sale');
    } else {
      if (this.priceRegularElement) this.priceRegularElement.textContent = price;
       const saleContainer = this.priceContainer.querySelector('.price__sale');
       if (saleContainer) saleContainer.classList.add(this.classes.hidden);
       const regularContainer = this.priceContainer.querySelector('.price__regular');
       if(regularContainer) regularContainer.classList.remove(this.classes.hidden);

      this.priceContainer.classList.remove('price--on-sale');
      if (this.priceCompareAtElement) this.priceCompareAtElement.textContent = '';
    }
  }
}

if (!customElements.get('product-swatches')) {
  customElements.define('product-swatches', ProductSwatches);
} 