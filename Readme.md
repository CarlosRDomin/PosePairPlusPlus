# PosePair++
This repo contains all the code pertaining the PosePair++ demo at IPSN'19.

### Settings on the watch
Different factors seem to affect watch performance, here's a list of settings that produce good results:
 * Connectivity > Bluetooth: **Off**
 * Developer options > Mobile battery saver: **Off**
 * Display > Always-on screen: **Off**
 * Gestures > Tilt-to-wake: **Off**
 * Gestures > Touch-to-wake: **Off**
 * Gestures > Wrist gestures: **Off**

### Visualization
The visualization code is divided into two main components:
 * A Node.js+Express backend server (in folder `visualization/server`). This server is responsible for receiving and parsing gRPC packets containing raw sensor data (launches its own gRPC server). _Note_: for debugging purposes, we also include a mock gRPC client which sends random sensor data using the appropriate proto-contract data structures.
 * A React-based frontend client (in folder `visualization/client`). This client displays a web interface that receives chunks of sensor data from the backend server (using Server-Side Events) and renders them in real-time using a plotting library (plotly.js).

#### How to run the visualization
First of all, make sure you have all the dependencies installed, by running:
```sh
sh visualization/install_npm_deps.sh
```
(which internally calls `npm install` for you)

There are currently two options based on the source of the sensor data (commands assume you first `cd visualization`):
 * If you want to use our mock gRPC data, run `npm run start-mock`
 * Otherwise, assuming smartwatch(es) are already feeding in sensor data, simply run `npm start` (or `npm run start`)

### Running OpenPose on GPU (Mac OS X instructions)
It is actually quite challenging to setup the environment for OpenPose to run on external GPUs on Mac, but we finally figured out how!

**IMPORTANT NOTE**: so far **this only works on Mac OS X High Sierra or below (10.13.6-)**, since Nvidia hasn't released web drivers for Mojave yet.

Instructions are divided into four main steps:
 - [Installing eGPU drivers + CUDA 10.1 + CuDNN 7.5](#installing-eGPU-drivers-and-CUDA)
 - Building Caffe (with GPU support) from source, for [Python 2](#building-Caffe-with-GPU-support-from-source---Python-2) or [Python 3](#building-Caffe-with-GPU-support-from-source---Python-3)
 - [Building OpenPose with GPU support](#building-OpenPose-with-GPU-support)

#### Installing eGPU drivers and CUDA
 1. Install eGPU drivers by following [these instructions](https://github.com/learex/macOS-eGPU#step-by-step-guide):
    1. Disable SIP, or at least kext signing: reboot while holding down Cmd+R, terminal `csrutil enable --without kext` (or `csrutil disable`) and reboot normally
    2. Disconnect peripherals (especially eGPUs) and open the terminal (not iTerm!)
    3. Ensure you are running with sudo privileges:
       ```sh
       sudo su
       ```
    4. Download the script:
       ```sh
       curl -s https://raw.githubusercontent.com/learex/macOS-eGPU/master/macOS-eGPU.sh > macOS-eGPU.sh && chmod +x macOS-eGPU.sh
       ```
    5. Install the script and patch for Mac OS X 10.13.6:
       ```sh
       ./macOS-eGPU.sh --install --iopcieTunneledPatch --nvidiaDriver --cudaDriver
       ```
    6. Reboot to complete installation
 2. Install CUDA 10.1 ([instructions here](https://docs.nvidia.com/cuda/cuda-installation-guide-mac-os-x/)):
    1. CUDA 10.1 requires Xcode 10.1 command line tools. If you have a different version of Xcode, follow these steps:
       1. Log in to https://developer.apple.com/downloads/
       2. Download [Xcode CLT (Command Line Tools) 10.1](https://download.developer.apple.com/Developer_Tools/Command_Line_Tools_macOS_10.13_for_Xcode_10.1/Command_Line_Tools_macOS_10.13_for_Xcode_10.1.dmg) and install
       3. Select the Command Line Tools you just downloaded
          ```sh
          sudo xcode-select --switch /Library/Developer/CommandLineTools
          ```
       4. Verify that clang has been downgraded via `clang --version` (should say Apple LLVM version 10.0.0 [...])
    2. Download [CUDA 10.1 installer](https://developer.nvidia.com/cuda-downloads?target_os=MacOSX&target_arch=x86_64&target_version=1013) and install CUDA
    3. Update your `PATH` and `DYLD_LIBRARY_PATH` by adding these lines at the end of your `~/.bash_profile`:
       ```sh
       export PATH="/Developer/NVIDIA/CUDA-10.1/bin:$PATH"
       export DYLD_LIBRARY_PATH="/Developer/NVIDIA/CUDA-10.1/lib:$DYLD_LIBRARY_PATH"
       ```
       and either opening a new tab/window or running `source ~/.bash_profile`.
    4. Verify the installation by:
       1. Running `kextstat | grep -i cuda` (and seeing one line output like [...] com.nvidia.CUDA (1.1.0) [...])
       2. Compiling and running one of the samples:
          ```sh
          cp -R /usr/local/cuda/samples ~/Documents/Nvidia\ Cuda\ Examples
          cd ~/Documents/Nvidia\ Cuda\ Examples
          make -C 1_Utilities/deviceQuery
          cd bin/x86_64/darwin/release
          ./deviceQuery
          ```
          should print some info about your GPU. (_Note_: at least in my case it will only show the eGPU if it was plugged when logged out [` > Log out` or right after rebooting but before logging in]; if you plug it in and run the test without logging out first, it'll fail)
 3. Install [cuDNN 7.5](https://developer.nvidia.com/cudnn) [needs (free) registration on the Nvidia developer program]:
    1. _(As of March 25th 2019 the latest version available for Mac for CUDA 10.1 is v7.5.0.56)_. [Download](https://developer.nvidia.com/compute/machine-learning/cudnn/secure/v7.5.0.56/prod/10.1_20190225/cudnn-10.1-osx-x64-v7.5.0.56.tgz) and extract the tgz file
    2. Copy the files to `/usr/local/cuda`, maintaining the folder structure (that is, files inside the downloaded `include` folder go inside `/usr/local/cuda/include` and `lib` inside `/usr/local/cuda/lib`). [[Original instructions](https://docs.nvidia.com/deeplearning/sdk/cudnn-install/index.html#install-mac)]
    3. Verify cuDNN was successfully installed:
       ```sh
       echo -e '#include"cudnn.h"\n int main(){return 0;}' | nvcc -x c - -o /dev/null -I/usr/local/cuda/include -L/usr/local/cuda/lib -lcudnn
       ```
       should not produce any error/output

#### Building Caffe (with GPU support) from source - Python 2
_Follow these instructions to build Caffe for Python 2. If you want to use Python 3, skip to the [next section](#building-Caffe-with-GPU-support-from-source---Python-3)._
 1. Clone Caffe's repo:
    ```sh
    git clone https://github.com/CMU-Perceptual-Computing-Lab/caffe && cd caffe
    ```
 2. Modify the file `cmake/Dependencies.cmake`:
    1. Comment out line 116 (the one that said `if(NOT APPLE)`)
    2. Delete the letters `else` from line 134 (so now it should say `if(APPLE)`)
 3. Create build dir:
    ```sh
    mkdir build && cd build
    ```
 4. Create a virtual environment and activate it (we suggest using [Miniconda](https://docs.conda.io/en/latest/miniconda.html)):
    ```sh
    conda create -y -n posepair python=2
    conda activate posepair
    ```
 5. Install dependencies:
    ```sh
    conda install opencv numpy mkl mkl-include boost protobuf glog gflags hdf5 lmdb leveldb snappy scikit-image
    ```
      - Currently, Anaconda's main channel doesn't provide the latest version of protobuf and opencv, which leads to problems down the road. Install/update them from `conda-forge`:
        ```sh
        conda install -c conda-forge protobuf opencv=4
        ```
      - (if `error: use of undeclared identifier 'CV_LOAD_IMAGE_COLOR'` is thrown when making Caffe on step 7 below) -> Apply https://github.com/BVLC/caffe/pull/6638 patch (offers OpenCV 4 compatibility)
 6. Configure project:
    ```sh
    cmake -Dpython_version=2 -DBLAS=MKL -DCMAKE_PREFIX_PATH="/Library/Developer/CommandLineTools/usr/bin;${CONDA_PREFIX}" -DCMAKE_INSTALL_PREFIX=${CONDA_PREFIX} ..
    ```
 7. Make Caffe:
    ```sh
    make -j8 install
    ```
 8. Avoid having to set `PYTHONPATH` every time by symlinking:
     ```sh
     python -c "import site; import os; caffe_path='${CONDA_PREFIX}/python/caffe'; os.chdir(caffe_path); print(os.symlink('_caffe.dylib', '_caffe.so') is None if not os.path.exists('_caffe.so') else '_caffe.so already exists, nothing to do'); site_pkgs=site.getsitepackages()[0]; os.chdir(site_pkgs); print(os.symlink(os.path.relpath(caffe_path, site_pkgs), 'caffe') is None if not os.path.exists('caffe') else 'caffe already symlinked to site-packages, nothing to do'); print('Symlinks done :)');"
     ```
  9. Test Caffe:
     ```sh
     python -c "import caffe; print('SUCCESS! Caffe version {} installed'.format(caffe.__version__))"
     ```

#### Building Caffe (with GPU support) from source - Python 3
_Follow these instructions to build Caffe for Python 3. If you want to use Python 2, check out the [previous section](#building-Caffe-with-GPU-support-from-source---Python-2) and skip this one._

For some reason I struggle to run `python -c "import caffe"` without getting a "beautiful" `Segmentation fault` on Python 3 + Miniconda. Not sure whether this is an issue with conda's version of some dependency, but here's the instructions I followed to compile the latest Caffe **with GPU support on Mac** (thanks to Homebrew).
  1. Clone Caffe's repo:
     ```sh
     git clone https://github.com/CMU-Perceptual-Computing-Lab/caffe && cd caffe
     ```
  2. Modify line 116 of file `cmake/Dependencies.cmake` from `if(NOT APPLE)` to `if(TRUE)`
  3. Install [Homebrew](https://brew.sh/):
     ```sh
     /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
     ```
  4. Install dependencies:
     ```sh
     brew install cmake numpy opencv openblas protobuf boost boost-python3 glog gflags hdf5 lmdb leveldb
     ```
      - Make sure `python3` points to Homebrew's Python 3:
        ```sh
        ls -l `which python3`
        ```
        should print something like `/usr/local/bin/python3 -> ../Cellar/python/3.7.3/bin/python3`.
      - If that's not the case:
        ```sh
        export PATH="/usr/local/opt/python/libexec/bin:$PATH"
        ```
  5. Create a virtual environment (replace `</path/to/new/virtualenv>` by the actual path where you'd like to create the virtualenv, e.g. `~/virtualenvs/posepair`) and activate it:
     ```sh
     python3 -m venv </path/to/new/virtualenv>
     source </path/to/new/virtualenv>/bin/activate
     ```
  6. Install python dependencies:
     ```sh
     pip install numpy protobuf scikit-image opencv-python
     ```
  7. Create build dir:
     ```sh
     mkdir build && cd build
     ```
  8. Configure project:
     ```sh
     cmake -Dpython_version=3 -DBLAS=Open -DCMAKE_PREFIX_PATH="/usr/local/Cellar/openblas/0.3.5" -DCMAKE_INSTALL_PREFIX=${VIRTUAL_ENV} ..
     ```
      - If you get an error saying that `The dependency target "pycaffe" of target "pytest" does not exist` caused by `-- Could NOT find Boost`, modify the file `cmake/Dependencies.cmake` (again):
        - In lines 157 and 164 replace `"python-py${boost_py_version}"` by `"python${boost_py_version}"`
        - In lines 158 and 165 replace `${Boost_PYTHON-PY${boost_py_version}_FOUND}` by `${Boost_PYTHON${boost_py_version}_FOUND}`
  9. Make Caffe:
     ```sh
     make -j8 install
     ```
     - (if `error: use of undeclared identifier 'CV_LOAD_IMAGE_COLOR'` is thrown) -> Apply https://github.com/BVLC/caffe/pull/6638 patch (offers OpenCV 4 compatibility)
  10. Avoid having to set `PYTHONPATH` every time by symlinking:
      ```sh
      python -c "import site; import os; caffe_path='${VIRTUAL_ENV}/python/caffe'; os.chdir(caffe_path); print(os.symlink('_caffe.dylib', '_caffe.so') is None if not os.path.exists('_caffe.so') else '_caffe.so already exists, nothing to do'); site_pkgs=site.getsitepackages()[0]; os.chdir(site_pkgs); print(os.symlink(os.path.relpath(caffe_path, site_pkgs), 'caffe') is None if not os.path.exists('caffe') else 'caffe already symlinked to site-packages, nothing to do'); print('Symlinks done :)');"
      ```
  11. Test Caffe:
      ```sh
      python -c "import caffe; print('SUCCESS! Caffe version {} installed'.format(caffe.__version__))"
      ```

#### Building OpenPose with GPU support
 1. Clone OpenPose's repo:
    ```sh
    git clone https://github.com/CMU-Perceptual-Computing-Lab/openpose.git && cd openpose
    ```
 2. Comment out line 327 (the one that said `op_detect_darwin_version(OSX_VERSION)`) of file `cmake/Cuda.cmake`
 3. Create build dir:
    ```sh
    mkdir build && cd build
    ```
 4. Activate your Python environment if you haven't done so, and define a custom env variable `PYTHON_ROOT` so the rest of the steps are the same for both Python versions:
    - Python 2 with conda:
      ```sh
      conda activate posepair
      export PYTHON_ROOT=$CONDA_PREFIX
      ```
    - Python 3 with venv:
      ```sh
      source </path/to/new/virtualenv>/bin/activate
      export PYTHON_ROOT=$VIRTUAL_ENV
      ```
 5. Configure project (if you don't have it installed, you might need to [install Doxygen](https://sourceforge.net/projects/doxygen/files/latest/download) first):
    ```sh
    cmake -DCaffe_INCLUDE_DIRS=${PYTHON_ROOT}/include -DCaffe_LIBS=${PYTHON_ROOT}/lib/libcaffe.dylib -DBUILD_CAFFE=OFF -DBUILD_PYTHON=ON -DBUILD_DOCS=ON -DCPU_ONLY=OFF -DGPU_MODE=CUDA -DCUDA_USE_STATIC_CUDA_RUNTIME=OFF -DDOWNLOAD_BODY_25_MODEL=ON -DDOWNLOAD_FACE_MODEL=ON -DDOWNLOAD_HAND_MODEL=ON -DWITH_OPENCV_WITH_OPENGL=ON -DCMAKE_PREFIX_PATH="/Library/Developer/CommandLineTools/usr/bin;${PYTHON_ROOT}" -DCMAKE_INSTALL_PREFIX=${PYTHON_ROOT} ..
    ```
 6. Make OpenPose:
    ```sh
    make -j8 install
    ```
 7. Avoid having to set `PYTHONPATH` every time by symlinking (assumes you are still inside the build folder of openpose):
    ```sh
    python -c "import site; import os; openpose_path='$PYTHON_ROOT/python/openpose'; models_path=os.path.join(openpose_path, 'models'); print(os.symlink(os.path.abspath('../models'), models_path) is None if not os.path.exists(models_path) else 'Models already symlinked, nothing to do'); site_pkgs=site.getsitepackages()[0]; os.chdir(site_pkgs); print(os.symlink(os.path.relpath(openpose_path, site_pkgs), 'openpose') is None if not os.path.exists('openpose') else 'openpose already symlinked to site-packages, nothing to do'); print('Symlinks done :)');"
    ```
 8. Test it:
    ```sh
    pushd examples/tutorial_api_python && python openpose_python.py && popd
    ```

### Building PyTorch from source
Finally, in order to use PyTorch with CUDA, it has to be compiled from source. Follow these instructions:
 1. Clone PyTorch:
    ```sh
    git clone --recursive https://github.com/pytorch/pytorch && cd pytorch
    ```
     - _Just in case, today's latest commit, which works, is: `git checkout 12abc8a99a5fc60603b3aecf5faa37600ad4fff6`_
 2. Install dependencies:
    - Python 2 with conda:
      ```sh
      conda activate posepair
      conda install -y numpy pyyaml setuptools cmake cffi mkl-include typing
      conda install torchvision --no-deps -c pytorch
      pip install future
      ```
    - Python 3 with venv:
      ```sh
      source </path/to/new/virtualenv>/bin/activate
      pip install pyyaml torchvision
      ```
 3. Compile and install PyTorch (go grab a coffe, it might take almost an hour...):
    ```sh
    export CUDNN_INCLUDE_DIR=/usr/local/cuda/include
    export CUDNN_LIB_DIR=/usr/local/cuda/lib
    MACOSX_DEPLOYMENT_TARGET=10.13.6 CC=clang CXX=clang++ python setup.py install
    ```
 4. Test PyTorch:
    ```sh
    pushd / && python -c "import torch; print('SUCCESS! PyTorch version {} installed'.format(torch.__version__)); t=torch.rand(3); r=t.cuda(); print('Here\'s a random 1x3 Tensor: {}'.format(r))" && popd
    ```
