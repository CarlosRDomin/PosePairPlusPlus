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

**IMPORTANT NOTE**: so far **this only works on Python 2.7** (Python 3 throws a `Segmentation fault` on `import caffe`) and **Mac OS X High Sierra or below (10.13.6-)**, since Nvidia hasn't released web drivers for Mojave yet.

Instructions are divided into four main steps:
 - [Installing eGPU drivers + CUDA 10.1 + CuDNN 7.5](installing-eGPU-drivers-and-CUDA)
 - [Building PyTorch from source](building-PyTorch-from-source)
 - [Building Caffe (with GPU support) from source](building-Caffe-with-GPU-support-from-source)
 - [Building OpenPose with GPU support](building-OpenPose-with-GPU-support)

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
       should not produce any error/output.

#### Building PyTorch from source
In order to use CUDA, PyTorch has to be compiled from source. Follow these instructions:
 1. Create a virtual environment:
    ```sh
    conda create -y -n posepair python=2
    conda activate posepair
    ```
 2. Install dependencies:
    ```sh
    conda install -y numpy pyyaml setuptools cmake cffi mkl-include typing
    pip install future
    ```
 3. Clone PyTorch:
    ```sh
    git clone --recursive https://github.com/pytorch/pytorch && cd pytorch
    ```
     - _Just in case, today's latest commit, which works, is: `git checkout ed8c462dc79461c434cdd69f378743d1258c624b`_
 4. Specify cuDNN path:
    ```sh
    export CUDNN_INCLUDE_DIR=/usr/local/cuda/include
    export CUDNN_LIB_DIR=/usr/local/cuda/lib
    ```
 5. Compile and install PyTorch:
    ```sh
    MACOSX_DEPLOYMENT_TARGET=10.13.6 CC=clang CXX=clang++ python setup.py install
    ```
 6. Test PyTorch:
    ```sh
    pushd / && python -c "import torch; print('SUCCESS! PyTorch version {} installed'.format(torch.__version__)); t=torch.rand(3); r=t.cuda(); print('Here\'s a random 1x3 Tensor: {}'.format(r))" && popd
    ```
 7. Last, install torchvision:
    ```sh
    conda install torchvision --no-deps -c pytorch
    ```

#### Building Caffe (with GPU support) from source
 1. Clone Caffe's repo:
    ```sh
    git clone https://github.com/CMU-Perceptual-Computing-Lab/caffe && cd caffe
    ```
 2. Modify the file `cmake/Dependencies.cmake`:
    1. Comment out line 116 (the one that said `#if(NOT APPLE)`)
    2. Delete the letters `else` from line 134 (so now it should say `if(APPLE)`)
 3. Create build dir:
    ```sh
    mkdir build && cd build
    ```
 4. Activate your Python environment if you haven't done so:
    ```sh
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
    cmake -Dpython_version=2 -DBLAS=MKL -DCMAKE_CXX_FLAGS="-std=c++11" -DCMAKE_PREFIX_PATH="/Library/Developer/CommandLineTools/usr/bin;${CONDA_PREFIX}" -DCMAKE_INSTALL_PREFIX=${CONDA_PREFIX} ..
    ```
 7. Make Caffe:
    ```sh
    make -j8 && make install
    ```
 8. Avoid having to set `PYTHONPATH` every time by symlinking:
     ```sh
     python -c "import site; import os; caffe_path='$CONDA_PREFIX/python/caffe'; os.chdir(caffe_path); print(os.symlink('_caffe.dylib', '_caffe.so') is None if not os.path.exists('_caffe.so') else '_caffe.so already exists, nothing to do'); site_pkgs=site.getsitepackages()[0]; os.chdir(site_pkgs); print(os.symlink(os.path.relpath(caffe_path, site_pkgs), 'caffe') is None if not os.path.exists('caffe') else 'caffe already symlinked to site-packages, nothing to do'); print('Symlinks done :)');"
     ```
  9. Test Caffe:
     ```sh
     pushd / && python -c "import caffe; print('SUCCESS! Caffe version {} installed'.format(caffe.__version__))" && popd
     ```

#### Building OpenPose with GPU support
 1. Clone OpenPose's repo:
    ```sh
    git clone https://github.com/CMU-Perceptual-Computing-Lab/openpose.git && cd openpose
    ```
 2. Comment out line 305 (the one that said `op_detect_darwin_version(OSX_VERSION)`) of file `cmake/Cuda.cmake`
 3. Create build dir:
    ```sh
    mkdir build && cd build
    ```
 4. Activate your Python environment if you haven't done so:
    ```sh
    conda activate posepair
    ```
 5. Configure project:
    ```sh
    cmake -DCaffe_INCLUDE_DIRS=${CONDA_PREFIX}/include -DCaffe_LIBS=${CONDA_PREFIX}/lib/libcaffe.dylib -DBUILD_CAFFE=OFF -DBUILD_PYTHON=ON -DBUILD_DOCS=ON -DCPU_ONLY=OFF -DGPU_MODE=CUDA -DCUDA_USE_STATIC_CUDA_RUNTIME=OFF -DDOWNLOAD_BODY_25_MODEL=ON -DDOWNLOAD_FACE_MODEL=ON -DDOWNLOAD_HAND_MODEL=ON -DWITH_OPENCV_WITH_OPENGL=ON -DCMAKE_PREFIX_PATH="/Library/Developer/CommandLineTools/usr/bin;${CONDA_PREFIX}" -DCMAKE_INSTALL_PREFIX=${CONDA_PREFIX} ..
    ```
    - If you don't have it installed, you might need to [install Doxygen](https://sourceforge.net/projects/doxygen/files/latest/download) first
 6. Make OpenPose:
    ```sh
    make -j8 && make install
    ```
 7. Avoid having to set `PYTHONPATH` every time by symlinking (assumes you are still inside the build folder of openpose):
    ```sh
    python -c "import site; import os; openpose_path='$CONDA_PREFIX/python/openpose'; models_path=os.path.join(openpose_path, 'models'); print(os.symlink(os.path.abspath('../models'), models_path) is None if not os.path.exists(models_path) else 'Models already symlinked, nothing to do'); site_pkgs=site.getsitepackages()[0]; os.chdir(site_pkgs); print(os.symlink(os.path.relpath(openpose_path, site_pkgs), 'openpose') is None if not os.path.exists('openpose') else 'openpose already symlinked to site-packages, nothing to do'); print('Symlinks done :)');"
    ```
 8. Test it:
    ```sh
    pushd examples/tutorial_api_python && python openpose_python.py && popd
    ```
