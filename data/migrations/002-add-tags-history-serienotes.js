module.exports = {
  version: 2,
  up(data) {
    // Add tags and status_history to all books
    for (const book of data.books) {
      if (!book.tags) book.tags = [];
      if (!book.status_history) book.status_history = [];
    }
    // Add serie_notes store
    if (!data.serie_notes) data.serie_notes = {};
    return data;
  },
};
