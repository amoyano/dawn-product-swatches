# Dawn Quick Add - Product Swatches

This project implements product swatches with real-time quantity updates and 'add to cart' functionality directly on collection pages.

### Preview Links
* [Preview](https://am-product-swatches.myshopify.com/collections/snowboard)
* Password: naysto

## Setup Instructions

1.  **Prerequisites:** Ensure you have the [Shopify CLI](https://shopify.dev/docs/themes/tools/cli) installed and configured for your store.
2.  **Clone/Download:** Place this theme code into your local development environment.
3.  **Navigate:** Open your terminal and navigate to the root directory of this theme.
4.  **Dev Theme:** Run the following command to start a local development server and preview the theme:
    ```bash
    shopify theme dev --store YOUR_STORE_NAME.myshopify.com
    ```
    Replace `YOUR_STORE_NAME.myshopify.com` with your actual store's myshopify domain.
5.  **Preview:** Open the preview link provided by the Shopify CLI in your browser. Navigate to a collection page or a page with a featured product section where product swatches should appear.

## Approach

The core functionality is handled by the `assets/product-swatches.js` component and the corresponding Liquid snippet (likely `snippets/product-swatches.liquid` or similar, integrated into product cards).

1.  **Component Initialization:** The `ProductSwatches` custom element initializes event listeners for swatch clicks and form submissions. It reads variant data (ID, image, availability, quantity) embedded in the HTML via data attributes. The visual appearance (color) of each swatch is determined by a **variant-level metafield named `color`** (namespace and key likely `custom.color` or similar), which should contain a valid CSS color value (e.g., `#FFFFFF`, `red`).
2.  **Swatch Interaction:** Clicking a swatch updates the main product image (if available) and highlights the selected swatch using `updateImage()` and `updateSwatchSelection()`. It also updates the hidden variant ID input within the embedded form.
3.  **Add to Cart Button State:** The `updateAddToCartButtonState()` method controls the 'Add to Cart' button's text and disabled state based on the selected variant's availability (`data-variant-available`) and quantity (`data-variant-quantity`). It displays remaining quantity when below a threshold (`data-quantity-threshold`).
4.  **AJAX Add to Cart:** The `handleAddSubmission()` method handles the form submission via AJAX (`fetch`).
    *   It prevents default form submission.
    *   Sends the selected variant ID and quantity to the Shopify Cart API (`/cart/add.js`).
    *   On success:
        *   Decrements the `data-variant-quantity` attribute on the selected swatch.
        *   Updates `data-variant-available` based on the new quantity.
        *   Calls `updateAddToCartButtonState()` to reflect the change.
        *   If the quantity becomes zero, it displays a "You have added the last one!" message, disables the button, and adds a `visually-disabled` class to the input.
        *   Updates the cart (drawer or notification) using Shopify's Sections API or redirects to the cart page.
    *   On error: Displays an error message and potentially updates the button text.
5.  **Code Reutilization (`product-variant-options`):** To accelerate development and leverage existing theme structures, the underlying structure and potentially some styling or Liquid logic from the standard `product-variant-options` or similar elements were likely reused or adapted for generating the swatch inputs and their associated data attributes. This is a common practice for straightforward features where building entirely from scratch doesn't offer significant advantages and speed is a factor.

This approach provides a dynamic user experience directly on product listing pages without requiring a full page load to select variants or see updated availability.
