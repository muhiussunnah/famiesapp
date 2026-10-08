/**
 * Built-in Famies menus, used until /admin/menus has enabled items.
 * Kept separate from menus.js (which talks to the database) so client
 * components like Navbar and Footer can import it.
 */
const item = (location, label, url) => ({ id: `${location}-${url}`, location, label, url, target: '_self' });

export const DEFAULT_MENUS = {
  header: [
    item('header', 'Hem', '/'),
    item('header', 'Inspiration', '/inspiration'),
    item('header', 'Skapa event', '/skapa-event'),
    item('header', 'Kontakt', '/contact'),
  ],
  footerExplore: [
    item('footer_explore', 'Hem', '/'),
    item('footer_explore', 'Så funkar det', '/#how'),
    item('footer_explore', 'Funktioner', '/#features'),
    item('footer_explore', 'Recensioner', '/#reviews'),
    item('footer_explore', 'Inspiration', '/inspiration'),
    item('footer_explore', 'Skapa event', '/skapa-event'),
  ],
  footerCompany: [
    item('footer_company', 'Kontakt', '/contact'),
    item('footer_company', 'Privacy Policy', '/privacy'),
    item('footer_company', 'Terms of Use', '/terms'),
    item('footer_company', 'Account Deletion Manual', '/deletion'),
  ],
  footerBottom: [],
};
