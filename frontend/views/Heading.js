var
  kind = require('enyo/kind'),
  Control = require('enyo/Control'),
  Divider = require('moonstone/Divider');

// Section heading: the stock moonstone/Divider, except that it shows the text exactly as it is written in the translation.
// Moonstone's Divider.contentChanged() capitalizes every word ("Title And Description"), which is right for English
// headings but wrong for Russian and most other languages ("Заголовок И Описание"). Moonstone itself is not touched:
// this kind only skips that one step and runs the plain Control.contentChanged() like the original does afterwards.
module.exports = kind({
  name: 'Heading',
  kind: Divider,
  contentChanged: function () {
    Control.prototype.contentChanged.apply(this, arguments);
  }
});
