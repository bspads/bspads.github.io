# Black Samurai · Инструкции к геймпадам

Сайт на MkDocs Material с интерактивными 2D-инструкциями к геймпадам Black Samurai.
Оформление и механика (тема, «Поделиться», «Закладка», поиск на главной, публикация через GitHub Actions)
перенесены с сайта поддержки Xprinter (`C:\site`).

```
pip install -r requirements.txt
mkdocs serve
```

- `docs/models/*.md` — страница геймпада; карточка на главной собирается из блока `model:` в шапке (`hooks/models.py`).
- `docs/assets/models/*.webp` — временные картинки: первая страница инструкции. Заменить на фото / вектор геймпада.
- `manuals/` — исходные PDF-инструкции (в git не попадают).
