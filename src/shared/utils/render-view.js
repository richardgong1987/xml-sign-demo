/**
 * Presenters return { view, model }; this hands it to the template engine.
 *
 * Because of this indirection controllers never import EJS — swapping template
 * engines touches only this file and utils/view-engine.js.
 */
export function renderView(response, { view, model }) {
    response.render(view, model);
}
