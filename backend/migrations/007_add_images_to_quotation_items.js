exports.up = function(knex) {
  return knex.schema.table('quotation_items', function(table) {
    table.text('images'); // JSON string array of base64 images
  });
};

exports.down = function(knex) {
  return knex.schema.table('quotation_items', function(table) {
    table.dropColumn('images');
  });
};
