# Plan Prompt

The goal of this repo is to develop a typescript website that will act as a "Factorio Production Tree" website. I plan on getting the actual game info from factorio --dump-data. If you can find these files online for each version please do that and add to this project...

I basically want to search and select and item, and then when I do that, a pretty tree comes on the screen that details each step of the production process... for example if I select "Automation Science" then a tree will appear that will show:

Automation Science
     |         |
copper plates  gears
     |           |
copper ore    iron plates
                |
            iron ore


so the items will be the nodes and the production buildings will be the branches... I want the branches to be editable to add modules/beacons/quality/etc/etc what you deem fit. We will not add converyor belt stats, but may add in the future.

The whole goal is that I will select say "20x Automation Science" and this tree will detail that production process AND how many of each building type I will need at minimum. Info is our friend, I like info but I also want the UI to be pretty, maybe hide things behind tooltips / extended view / modal idk you decide what looks cleanest.

If you have any legitimate questions don't hesitate to ask.

This will be hosted on netlify and I want you using pretty much vanilla typescript