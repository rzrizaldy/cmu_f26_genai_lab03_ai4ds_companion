# Notification Lab · AI for Data Science

Interactive companion for the Generative AI Lab, Fall 2026, prepared by Rizaldy Utomo.
Three missions using original Duolingo notification logs: check the winner, improve the prediction,
and challenge the launch. Static page with precomputed results; no API keys or notebook files.

The 16-slide companion connects review feedback, text analysis, response design, testing and
monitoring. Open [the feedback operating room](operations.html) for a 17-day historical replay
of 500 sampled reviews, recorded AI next-check suggestions and reviewable response drafts.
[Grafana configuration](feedback_dashboard.json) uses the same aggregates. No live connection,
delivered campaign or causal link between the historical source cohorts is claimed.

Data: Yancey & Settles (2020), Harvard Dataverse V1, https://doi.org/10.7910/DVN/23ZWVI .
CC BY-NC 4.0, https://creativecommons.org/licenses/by-nc/4.0/ . Adaptation: aggregate results from
uniform samples of train-part-3 and test-part-2, preserving original fields. No synthetic observations.
Paper: https://doi.org/10.1145/3394486.3403351 .
Separate review-text pilot: https://www.kaggle.com/datasets/ganangsetyohadi/duolingo-google-play-reviews
(Ganang Setyohadi, April 2025 scrape, publisher-declared MIT). Only aggregate metrics and a short
review excerpt are included. Six examples from the paper and official Duolingo posts illustrate
message types; teaching categories cannot be mapped to anonymous A-L log IDs. JEV topic tags
remain unvalidated drafts. The optional raw social-caption corpus is not included.

Unofficial teaching page; not affiliated with or endorsed by Duolingo. Icons are original drawings.
