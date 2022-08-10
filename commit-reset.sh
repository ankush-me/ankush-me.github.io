# -- Remove the history from 
rm -rf .git

# -- recreate the repos from the current content only
git init
git add .
git commit -m "initial commit"

# -- push to the github remote repos ensuring you overwrite history
git remote add origin git@github.com:ankush-me/ankush-me.github.io.git
git push -u --force origin main
