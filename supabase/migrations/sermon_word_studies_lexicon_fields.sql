alter table sermon_word_studies
  add column if not exists kjv_def text,
  add column if not exists derivation text;
