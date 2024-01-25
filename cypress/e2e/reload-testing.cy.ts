// Tests fail sporadically. Better class stability and consistent loading timeframes should be built into notebook.
// For now, run enough times till you can see every test pass at least once.
describe('EditorJS Reload', function() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  beforeEach(() => cy.clearIndexedDB());
  it('should input content to EditorJS and retrieve the same content after reload', function() {
    cy.visit('http://localhost:4200/?t=lcbkvhcafy&p=xvgctvcyva');
    cy.wait(10000);
    cy.get('.ce-header').type("{enter}0{enter}");
    cy.get('.ce-paragraph').eq(1).type("1{enter}");
    cy.get('.ce-paragraph').eq(2).type("2{enter}");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(5000);
    cy.reload();
    cy.get('.ce-paragraph').eq(0).should("contain.text", "0");
    cy.get('.ce-paragraph').eq(1).should("contain.text", "1");
    cy.get('.ce-paragraph').eq(2).should("contain.text", "2");
  });

});
