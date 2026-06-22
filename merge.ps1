git add .
git commit -m "fix: eslint prefer-const errors"
git checkout main
git merge vikas/addition_of_feature --no-ff -m "Merge branch vikas/addition_of_feature into main"
git push origin main
git log -n 1 --format="%H"
