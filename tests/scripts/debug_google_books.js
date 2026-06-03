const isbn = '9780316769488';
fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  });
