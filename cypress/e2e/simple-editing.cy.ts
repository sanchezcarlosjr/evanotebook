// Due to instabilities, this seems to occasionally fail.

describe('EditorJS interaction', function() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  beforeEach(() => cy.clearIndexedDB());
  it('should input content to EditorJS and retrieve the same content after reload', function() {
    cy.visit('http://localhost:4200');
    cy.get('.ce-header').click().type("Title{enter}");
    cy.get('.ce-paragraph').type("1{enter}2{enter}3{enter}4{enter}5");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(500);
    cy.reload();
    cy.get('.ce-header').should('contain', "Title");
    cy.get('.ce-paragraph').each(($el, index) => {
      cy.wrap($el).should('contain', index+1);
    });
  });

  it('should update content and retrieve the same content after reload', function() {
    cy.visit('http://localhost:4200');
    cy.get('.ce-header').click().type("Title"+"{enter}");
    cy.get('.ce-paragraph').type("1{enter}");
    cy.get('.ce-paragraph').eq(1).type("2{enter}");
    cy.get('.ce-paragraph').eq(2).type("3{enter}");
    cy.get('.ce-paragraph').eq(3).type("4{enter}");
    cy.get('.ce-paragraph').eq(4).type("5");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(500);
    cy.reload();
    cy.get('.ce-header').click().type("Title A");
    cy.get('.ce-paragraph').eq(0).type("1 B");
    cy.get('.ce-paragraph').eq(1).type("2 C");
    cy.get('.ce-paragraph').eq(2).type("3 D");
    cy.get('.ce-paragraph').eq(3).type("4 E");
    cy.get('.ce-paragraph').eq(4).type("5 F");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(500);
    cy.reload();
    cy.get('.ce-header').should('contain', "Title A");
    cy.get('.ce-paragraph').should('contain', "1 B");
    cy.get('.ce-paragraph').should('contain',"2 C");
    cy.get('.ce-paragraph').should('contain',"3 D");
    cy.get('.ce-paragraph').should('contain',"4 E");
    cy.get('.ce-paragraph').should('contain',"5 F");
  });

  it('should delete content with backspace and retrieve the same content after reload', function() {
    cy.visit('http://localhost:4200');
    cy.get('.ce-header').click().type("Title"+"{enter}");
    cy.get('.ce-paragraph').type("1{enter}");
    cy.get('.ce-paragraph').eq(1).type("2{enter}");
    cy.get('.ce-paragraph').eq(2).type("3{enter}");
    cy.get('.ce-paragraph').eq(3).type("4{enter}");
    cy.get('.ce-paragraph').eq(4).type("5");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(500);
    cy.reload();
    cy.get('.ce-header').click().type("Title");
    cy.get('.ce-paragraph').eq(0).type("1 B");
    cy.get('.ce-paragraph').eq(1).type("2 C");
    cy.get('.ce-paragraph').eq(2).type("3 D");
    cy.get('.ce-paragraph').eq(3).type("4 E");
    cy.get('.ce-paragraph').eq(4).type("5 F");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(500);
    cy.reload();
    cy.get('.ce-paragraph').eq(1).type("{selectall}{backspace}{backspace}");
    cy.get('.ce-paragraph').eq(2).type("{selectall}{backspace}{backspace}");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(500);
    cy.reload();
    cy.wait(500);
    cy.get('.ce-header').should('contain', "Title");
    cy.get('.ce-paragraph').eq(0).should('contain', "1 B");
    cy.get('.ce-paragraph').eq(1).should('contain',"3 D");
    cy.get('.ce-paragraph').eq(2).should('contain',"5 F");
  });

  it('should delete content with button and retrieve the same content after reload', function() {
    cy.visit('http://localhost:4200');
    cy.get('.ce-header').click().type("Title"+"{enter}");
    cy.get('.ce-paragraph').type("1{enter}");
    cy.get('.ce-paragraph').eq(1).type("2{enter}");
    cy.get('.ce-paragraph').eq(2).type("3{enter}");
    cy.get('.ce-paragraph').eq(3).type("4{enter}");
    cy.get('.ce-paragraph').eq(4).type("5{enter}");
    cy.get('.ce-paragraph').eq(5).type("6");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(500);
    cy.reload();
    cy.get('.ce-header').click().type("Title A");
    cy.get('.ce-paragraph').eq(0).type("1 B");
    cy.get('.ce-paragraph').eq(1).type("2 C");
    cy.get('.ce-paragraph').eq(2).type("3 D");
    cy.get('.ce-paragraph').eq(3).type("4 E");
    cy.get('.ce-paragraph').eq(4).type("5 F");
    cy.get('.ce-paragraph').eq(5).type("6 G");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(500);
    cy.reload();
    cy.get('.ce-paragraph').eq(1).click().get('.ce-toolbar__settings-btn').click().get('[data-item-name="delete"]').click().get('[data-item-name="delete"]').click();
    cy.get('.ce-paragraph').eq(2).click().get('.ce-toolbar__settings-btn').click().get('[data-item-name="delete"]').click().get('[data-item-name="delete"]').click();
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(500);
    cy.reload();
    cy.wait(500);
    cy.get('.ce-header').should('contain', "Title A");
    cy.get('.ce-paragraph').eq(0).should('contain', "1 B");
    cy.get('.ce-paragraph').eq(1).should('contain',"3 D");
    cy.get('.ce-paragraph').eq(2).should('contain',"5 F");
    cy.get('.ce-paragraph').eq(3).should('contain',"6 G");
  });

  it('should delete content with multiple selection and retrieve the same content after reload', function() {
    cy.visit('http://localhost:4200');
    cy.get('.ce-header').click().type("Title"+"{enter}");
    cy.get('.ce-paragraph').type("1{enter}");
    cy.get('.ce-paragraph').eq(1).type("2{enter}");
    cy.get('.ce-paragraph').eq(2).type("3{enter}");
    cy.get('.ce-paragraph').eq(3).type("4{enter}");
    cy.get('.ce-paragraph').eq(4).type("5{enter}");
    cy.get('.ce-paragraph').eq(5).type("6");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.get('.ce-paragraph').eq(3).click().type("{shift}{uparrow}{uparrow}{backspace}");
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.wait(1000);
    cy.reload();
    cy.get('.ce-paragraph').eq(0).should('contain', "1");
    cy.get('.ce-paragraph').eq(1).should('contain',"2");
    cy.get('.ce-paragraph').eq(2).should('contain.text',"");
    cy.get('.ce-paragraph').eq(3).should('contain',"5");
    cy.get('.ce-paragraph').eq(4).should('contain',"6");
  });

  it('should move up with button and retrieve the same content after reload', function() {
    cy.visit('http://localhost:4200');
    cy.get('.ce-header').click().type("Title"+"{enter}");
    cy.get('.ce-paragraph').type("1{enter}");
    cy.get('.ce-paragraph').eq(1).type("2{enter}");
    cy.get('.ce-paragraph').eq(2).type("3{enter}");
    cy.get('.ce-paragraph').eq(3).type("4{enter}");
    cy.get('.ce-paragraph').eq(4).type("5{enter}");
    cy.get('.ce-paragraph').eq(5).type("6");
    cy.get('.ce-paragraph').eq(3)
                           .click()
                           .get('.ce-toolbar__settings-btn').click()
                           .get('[data-item-name="move-up"]').click()
                           .get('[data-item-name="move-up"]').click();
    cy.get('#checkpoint').should('contain', 'Saving');
    cy.get('.ce-paragraph').eq(0).should('contain',"1");
    cy.get('.ce-paragraph').eq(1).should('contain',"4");
    cy.get('.ce-paragraph').eq(2).should('contain',"2");
    cy.get('.ce-paragraph').eq(3).should('contain',"3");
    cy.get('.ce-paragraph').eq(4).should('contain',"5");
    cy.get('.ce-paragraph').eq(5).should('contain',"6");
    cy.wait(6000);
    cy.reload();
    cy.get('.ce-paragraph').eq(0).should('contain',"1");
    cy.get('.ce-paragraph').eq(1).should('contain',"4");
    cy.get('.ce-paragraph').eq(2).should('contain',"2");
    cy.get('.ce-paragraph').eq(3).should('contain',"3");
    cy.get('.ce-paragraph').eq(4).should('contain',"5");
    cy.get('.ce-paragraph').eq(5).should('contain',"6");
  });
});
