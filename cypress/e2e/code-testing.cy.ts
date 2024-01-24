describe('EditorJS Code Testing', function() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  beforeEach(() => cy.clearIndexedDB());

  it('input content to EditorJS and retrieve the same content after reload', function() {
    cy.visit('http://localhost:4200');
    cy.get('.ce-header').click().get('.ce-toolbar__plus').click().get('[data-item-name="code"]').click();
    cy.get('.editor').type("'Hello World!'{shift}{enter}");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(20000);
    cy.get('.output').should('contain', "'Hello World!'");
  });

});
