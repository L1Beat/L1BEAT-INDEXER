Create a frontend dashboard that has settings:

Period 1 start (default - March 15th 2025)

Period 1 end (default - April 15th 2025)

Period 2 start (default - June 15 2025)

Period 2 end (default - July 15 2025)

In the UI by default would be selected no chains (checkboxes), on select a card
with this chain is shown with 3 cols - params, period one, period 2

Numbers

(done) total txs - on the end of period

(done) daiy tx - txs in period divided by amount of days (no need for a separate
api call)

txs in period - difference between tx count on beggining and the end (no need
fot an api method, just do it on the frontend with 2 requests - beggining and
end)

(done) active addresses - addresses ever made any txs (field from) (needs an
indexer)

(done) Average Daily active users - any unique addresses sent txs - need
confirmation

gas daily used - requires a separate gas usage indexer. actually piggy pig that
to tx counter

icm messages sent in period - use existing data
