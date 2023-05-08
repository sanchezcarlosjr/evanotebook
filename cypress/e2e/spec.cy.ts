
describe('My First Test', () => {
  it('Visits the initial project page', () => {
     const relay = '/ip4/127.0.0.1/tcp/39587/ws/p2p/12D3KooWPwARzcLrhjRG4pKHrkXpzEKq8XRphMs2rKAW6uaqFftd';
     cy.visit(`http://localhost:4200/p2p?mas=${relay}`);
     for (const node of [0, 1, 2, 3, 4]) {
      cy.get('#node' + node).contains(relay);
     }
  });
});
